/**
 * Patches @capacitor-community/bluetooth-le iOS Device.swift so ProGenia
 * orientation notifies can be relayed natively (localhost WS) on iPad instead
 * of crossing the Capacitor bridge per sample.
 *
 * Idempotent — safe to run after every npm install.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deviceTarget = path.join(
  root,
  "node_modules/@capacitor-community/bluetooth-le/ios/Plugin/Device.swift",
);
const managerTarget = path.join(
  root,
  "node_modules/@capacitor-community/bluetooth-le/ios/Plugin/DeviceManager.swift",
);
const pluginTarget = path.join(
  root,
  "node_modules/@capacitor-community/bluetooth-le/ios/Plugin/Plugin.swift",
);

const marker = "ProgeniaBleImuPacket";
const snippet = `        let packetData = characteristic.value!
        // ProGenia iPad: forward orientation notifies to native WS relay.
        let charUuid = cbuuidToStringUppercase(characteristic.uuid)
        if charUuid == "6FBE1D31-9A2C-4F1E-9C3A-7B2E1A0D4F01" {
            // Diagnostic: rate at the raw CoreBluetooth delegate, before any relay.
            progeniaImuCbCount += 1
            let nowTs = Date()
            if nowTs.timeIntervalSince(progeniaImuCbWindow) >= 1.0 {
                NSLog(
                    "ProgeniaCapBLE imu_cb_hz=%d main_thread=%d",
                    progeniaImuCbCount,
                    Thread.isMainThread ? 1 : 0
                )
                progeniaImuCbCount = 0
                progeniaImuCbWindow = nowTs
            }
            NotificationCenter.default.post(
                name: NSNotification.Name("ProgeniaBleImuPacket"),
                object: nil,
                userInfo: ["data": packetData]
            )
            if UserDefaults.standard.bool(forKey: "ProgeniaBleRelayActive") {
                return
            }
        }
        // reading
        let valueString = dataToString(packetData)`;

if (!fs.existsSync(deviceTarget)) {
  console.warn("[patch-bluetooth-le-relay] Device.swift not found — skip");
  process.exit(0);
}

let deviceSrc = fs.readFileSync(deviceTarget, "utf8");
if (deviceSrc.includes(marker)) {
  console.log("[patch-bluetooth-le-relay] already patched");
} else {
  const oldBlock = `        if characteristic.value == nil {
            self.reject(key, "Characteristic contains no value.")
            return
        }
        // reading
        let valueString = dataToString(characteristic.value!)`;

  if (!deviceSrc.includes(oldBlock)) {
    console.warn(
      "[patch-bluetooth-le-relay] unexpected Device.swift — manual patch required",
    );
    process.exit(1);
  }

  deviceSrc = deviceSrc.replace(oldBlock, snippet);
  fs.writeFileSync(deviceTarget, deviceSrc);
  console.log("[patch-bluetooth-le-relay] patched Device.swift");
}

// Per-second RX counters used by the imu_cb_hz diagnostic above.
if (!deviceSrc.includes("progeniaImuCbCount = 0\n    private var")) {
  const propsBefore = `    private var characteristicsCount = 0
    private var characteristicsDiscovered = 0`;
  const propsAfter = `    private var characteristicsCount = 0
    private var characteristicsDiscovered = 0
    private var progeniaImuCbCount = 0
    private var progeniaImuCbWindow = Date()`;
  if (!deviceSrc.includes("progeniaImuCbWindow") && deviceSrc.includes(propsBefore)) {
    deviceSrc = deviceSrc.replace(propsBefore, propsAfter);
    fs.writeFileSync(deviceTarget, deviceSrc);
    console.log("[patch-bluetooth-le-relay] added imu_cb_hz counters");
  }
}

// Explicit Xcode logs are required because the plugin's internal log() output
// is not visible in release-like device runs.
if (fs.existsSync(managerTarget)) {
  let managerSrc = fs.readFileSync(managerTarget, "utf8");
  const queueBefore = `    private var centralManager: CBCentralManager!`;
  const queueAfter = `    private var centralManager: CBCentralManager!
    // Keep high-rate BLE delegates off WKWebView/Three.js main thread.
    private let centralQueue = DispatchQueue(
        label: "com.progenia.capacitor-ble.central",
        qos: .userInteractive
    )`;
  if (!managerSrc.includes("com.progenia.capacitor-ble.central")) {
    managerSrc = managerSrc.replace(queueBefore, queueAfter);
  }
  managerSrc = managerSrc.replace(
    "CBCentralManager(delegate: self, queue: DispatchQueue.main)",
    "CBCentralManager(delegate: self, queue: centralQueue)",
  );
  if (!managerSrc.includes("central_queue=dedicated")) {
    managerSrc = managerSrc.replace(
      `        self.centralManager = CBCentralManager(delegate: self, queue: centralQueue)`,
      `        NSLog("ProgeniaCapBLE central_queue=dedicated")
        self.centralManager = CBCentralManager(delegate: self, queue: centralQueue)`,
    );
  }

  const patches = [
    [
      `        log("Connecting to peripheral", device.getPeripheral())
        self.centralManager.connect(device.getPeripheral(), options: nil)`,
      `        log("Connecting to peripheral", device.getPeripheral())
        NSLog("ProgeniaCapBLE connect id=%@", device.getId())
        self.centralManager.connect(device.getPeripheral(), options: nil)`,
    ],
    [
      `        log("Connected to device", peripheral)
        let key = "connect|\\(peripheral.identifier.uuidString)"`,
      `        log("Connected to device", peripheral)
        NSLog("ProgeniaCapBLE did_connect id=%@", peripheral.identifier.uuidString)
        let key = "connect|\\(peripheral.identifier.uuidString)"`,
    ],
  ];
  for (const [before, after] of patches) {
    if (!managerSrc.includes(after) && managerSrc.includes(before)) {
      managerSrc = managerSrc.replace(before, after);
    }
  }
  fs.writeFileSync(managerTarget, managerSrc);
}

// The upstream iOS initialize method replaces DeviceManager (and therefore
// CBCentralManager) on every call. Make it idempotent to preserve pending iPad
// connections even if another app flow initializes BLE again.
if (fs.existsSync(pluginTarget)) {
  let pluginSrc = fs.readFileSync(pluginTarget, "utf8");
  const before = `    @objc func initialize(_ call: CAPPluginCall) {
        self.deviceManager = DeviceManager`;
  const after = `    @objc func initialize(_ call: CAPPluginCall) {
        // ProGenia: exactly one CBCentralManager per app process.
        if self.deviceManager != nil {
            call.resolve()
            return
        }
        self.deviceManager = DeviceManager`;
  if (!pluginSrc.includes(after) && pluginSrc.includes(before)) {
    pluginSrc = pluginSrc.replace(before, after);
  }

  if (!pluginSrc.includes("import UIKit")) {
    pluginSrc = pluginSrc.replace(
      "import CoreBluetooth\n",
      "import CoreBluetooth\nimport UIKit\n",
    );
  }

  const loadBefore = `    override public func load() {
        self.displayStrings = self.getDisplayStrings()
    }`;
  const loadAfter = `    override public func load() {
        self.displayStrings = self.getDisplayStrings()
        let release: (Notification) -> Void = { [weak self] _ in
            self?.progeniaReleaseAllBleConnections()
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main,
            using: release
        )
        NotificationCenter.default.addObserver(
            forName: UIApplication.willTerminateNotification,
            object: nil,
            queue: .main,
            using: release
        )
    }

    /** Drop GATT links when the app backgrounds so the ESP32 accepts another central. */
    private func progeniaReleaseAllBleConnections() {
        guard let deviceManager = self.deviceManager else { return }
        UserDefaults.standard.set(false, forKey: "ProgeniaBleRelayActive")
        for (_, device) in self.deviceMap where device.isConnected() {
            NSLog("ProgeniaCapBLE background_disconnect id=%@", device.getId())
            deviceManager.disconnect(device, 2.0) { _, _ in }
        }
    }`;
  if (!pluginSrc.includes("progeniaReleaseAllBleConnections") && pluginSrc.includes(loadBefore)) {
    pluginSrc = pluginSrc.replace(loadBefore, loadAfter);
  }

  fs.writeFileSync(pluginTarget, pluginSrc);
}
