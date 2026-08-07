import Foundation
import Darwin
import Network
import CoreBluetooth
import Capacitor
import Vision
import UIKit

/**
 Vision rectangle detect + native IMU streams (BLE/UDP/TCP).
 All high-rate samples use ProgeniaLocalQuatServer, never one Capacitor bridge call per sample.
 */
@objc(ProgeniaArFramePlugin)
public class ProgeniaArFramePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProgeniaArFramePlugin"
    public let jsName = "ProgeniaArFrame"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "detectRectangle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startUdpStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startTcpStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startBleStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pollOrientation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pingHost", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanFrameHosts", returnType: CAPPluginReturnPromise)
    ]

    private let ioQueue = DispatchQueue(
        label: "com.progenia.frame.stream",
        qos: .userInteractive
    )
    private var udpFd: Int32 = -1
    private var udpSource: DispatchSourceRead?
    private var tcpConnection: NWConnection?
    private var lineBuffer = Data()
    private let localQuatServer = ProgeniaLocalQuatServer()
    private var pendingW = 1.0
    private var pendingX = 0.0
    private var pendingY = 0.0
    private var pendingZ = 0.0
    private var pendingDirty = false
    private var sampleSeq: UInt64 = 0
    private var rxCount: UInt32 = 0
    private var lastRxHz: UInt32 = 0
    private var lastHzTick = Date()
    private var tcpConnectCall: CAPPluginCall?
    private var tcpDidResolve = false
    private var streamMode: String?
    private var bleCentral: CBCentralManager?
    private var blePeripheral: CBPeripheral?
    private var bleOrientationCharacteristic: CBCharacteristic?
    private var bleCommandCharacteristic: CBCharacteristic?
    private var bleStartCall: CAPPluginCall?
    private var bleTargetIdentifier: UUID?
    private var bleTimeout: DispatchWorkItem?
    private var bleRateProbe: DispatchWorkItem?
    private var bleWarmupRetries = 0
    private let frameServiceUUID = CBUUID(string: "6FBE1D30-9A2C-4F1E-9C3A-7B2E1A0D4F01")
    private let frameOrientationUUID = CBUUID(string: "6FBE1D31-9A2C-4F1E-9C3A-7B2E1A0D4F01")
    private let frameCommandUUID = CBUUID(string: "6FBE1D32-9A2C-4F1E-9C3A-7B2E1A0D4F01")
    // MARK: - Vision

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "engine": "vision",
            "stream": true
        ])
    }

    @objc func detectRectangle(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"), !base64.isEmpty else {
            call.reject("base64 image required")
            return
        }

        let cleaned = base64.replacingOccurrences(of: "data:image/jpeg;base64,", with: "")
            .replacingOccurrences(of: "data:image/png;base64,", with: "")

        guard let data = Data(base64Encoded: cleaned),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.resolve(["found": false])
            return
        }

        let request = VNDetectRectanglesRequest()
        request.minimumAspectRatio = 0.4
        request.maximumAspectRatio = 2.5
        request.minimumSize = 0.12
        request.maximumObservations = 8
        request.quadratureTolerance = 22
        request.minimumConfidence = 0.4

        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
                guard let results = request.results, !results.isEmpty else {
                    call.resolve(["found": false])
                    return
                }

                let best = results.max { a, b in
                    let sa = a.boundingBox.width * a.boundingBox.height * CGFloat(a.confidence)
                    let sb = b.boundingBox.width * b.boundingBox.height * CGFloat(b.confidence)
                    return sa < sb
                }

                guard let rect = best else {
                    call.resolve(["found": false])
                    return
                }

                func flip(_ p: CGPoint) -> [String: Double] {
                    ["x": Double(p.x), "y": Double(1.0 - p.y)]
                }

                let corners: [[String: Double]] = [
                    flip(rect.topLeft),
                    flip(rect.topRight),
                    flip(rect.bottomRight),
                    flip(rect.bottomLeft)
                ]

                call.resolve([
                    "found": true,
                    "corners": corners,
                    "confidence": Double(rect.confidence),
                    "source": "vision"
                ])
            } catch {
                call.resolve(["found": false])
            }
        }
    }

    // MARK: - Stream API

    /**
     * BLE stream without @capacitor-community/bluetooth-le notifications.
     * CoreBluetooth consumes compact 20-byte packets natively and forwards
     * samples through localhost WebSocket, avoiding WKWebView bridge pressure.
     */
    @objc func startBleStream(_ call: CAPPluginCall) {
        stopStreamInternal()
        streamMode = "native-ble"
        bleStartCall = call
        bleWarmupRetries = 0
        if let id = call.getString("deviceId") {
            bleTargetIdentifier = UUID(uuidString: id)
        } else {
            bleTargetIdentifier = nil
        }

        do {
            try localQuatServer.start()
        } catch {
            bleStartCall = nil
            call.reject("local ws failed: \(error.localizedDescription)")
            return
        }

        let central = CBCentralManager(
            delegate: self,
            queue: ioQueue,
            options: [CBCentralManagerOptionShowPowerAlertKey: true]
        )
        bleCentral = central

        let timeout = DispatchWorkItem { [weak self] in
            guard let self = self, let pending = self.bleStartCall else { return }
            self.bleStartCall = nil
            pending.reject("Timeout BLE (15 s). Ligue a moldura e aproxime-a do iPhone.")
            self.stopBleInternal()
            self.localQuatServer.stop()
        }
        bleTimeout = timeout
        ioQueue.asyncAfter(deadline: .now() + 15, execute: timeout)
    }

    @objc func startUdpStream(_ call: CAPPluginCall) {
        let portValue = call.getInt("port") ?? 9091
        stopStreamInternal()

        let fd = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
        guard fd >= 0 else {
            call.reject("udp socket failed")
            return
        }

        var yes: Int32 = 1
        _ = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))
        _ = setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &yes, socklen_t(MemoryLayout<Int32>.size))

        var addr = sockaddr_in()
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = in_port_t(UInt16(portValue).bigEndian)
        addr.sin_addr = in_addr(s_addr: INADDR_ANY.bigEndian)

        let bindOk = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bindOk == 0 else {
            close(fd)
            call.reject("udp bind :\(portValue) failed")
            return
        }

        udpFd = fd
        streamMode = "native-udp"
        do {
            try localQuatServer.start()
        } catch {
            close(fd)
            udpFd = -1
            call.reject("local ws failed: \(error.localizedDescription)")
            return
        }

        let source = DispatchSource.makeReadSource(fileDescriptor: fd, queue: ioQueue)
        source.setEventHandler { [weak self] in
            self?.drainUdp()
        }
        source.setCancelHandler {
            close(fd)
        }
        udpSource = source
        source.resume()

        call.resolve(["ok": true, "mode": "native-udp", "port": portValue])
    }

    @objc func startTcpStream(_ call: CAPPluginCall) {
        let host = call.getString("host") ?? "192.168.4.1"
        let portValue = call.getInt("port") ?? 83
        guard let port = NWEndpoint.Port(rawValue: UInt16(portValue)) else {
            call.reject("invalid port")
            return
        }

        stopStreamInternal()
        tcpConnectCall = call
        tcpDidResolve = false
        streamMode = "native-tcp"

        let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)
        tcpConnection = conn

        conn.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                do {
                    try self.localQuatServer.start()
                } catch {
                    self.rejectTcpOnce("local ws failed: \(error.localizedDescription)")
                    self.stopStreamInternal()
                    return
                }
                self.receiveTcp()
                self.resolveTcpOnce(["ok": true, "mode": "native-tcp", "host": host, "port": portValue])
            case .failed(let error):
                self.rejectTcpOnce("tcp failed: \(error.localizedDescription)")
                self.notifyListeners("streamStatus", data: [
                    "state": "error",
                    "message": error.localizedDescription
                ])
                self.stopStreamInternal()
            case .cancelled:
                self.notifyListeners("streamStatus", data: ["state": "idle"])
            default:
                break
            }
        }
        conn.start(queue: ioQueue)

        ioQueue.asyncAfter(deadline: .now() + 5) { [weak self] in
            guard let self = self, !self.tcpDidResolve else { return }
            self.rejectTcpOnce("timeout abrindo TCP :\(portValue)")
            self.stopStreamInternal()
        }
    }

    @objc func stopStream(_ call: CAPPluginCall) {
        stopStreamInternal()
        call.resolve()
    }

    /// Latest sample for JS pull (avoids slow notifyListeners bridge).
    @objc func pollOrientation(_ call: CAPPluginCall) {
        ioQueue.async {
            let payload: [String: Any] = [
                "ok": self.sampleSeq > 0,
                "w": self.pendingW,
                "x": self.pendingX,
                "y": self.pendingY,
                "z": self.pendingZ,
                "seq": self.sampleSeq,
                "rxHz": self.lastRxHz,
                "wsTxHz": self.localQuatServer.lastTxHz,
                "wsClients": self.localQuatServer.clientCount
            ]
            DispatchQueue.main.async { call.resolve(payload) }
        }
    }

    /// TCP reachability for LAN discovery (bypasses WKWebView fetch).
    @objc func pingHost(_ call: CAPPluginCall) {
        let host = call.getString("host") ?? ""
        let portValue = call.getInt("port") ?? 80
        let timeoutMs = call.getInt("timeoutMs") ?? 2000
        guard !host.isEmpty, let port = NWEndpoint.Port(rawValue: UInt16(portValue)) else {
            call.reject("host/port required")
            return
        }

        let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)
        var finished = false
        let finish: (Result<Void, Error>) -> Void = { result in
            guard !finished else { return }
            finished = true
            conn.cancel()
            DispatchQueue.main.async {
                switch result {
                case .success:
                    call.resolve(["ok": true, "host": host, "port": portValue])
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
        }

        conn.stateUpdateHandler = { state in
            switch state {
            case .ready:
                finish(.success(()))
            case .failed(let error):
                finish(.failure(error))
            default:
                break
            }
        }
        conn.start(queue: ioQueue)
        ioQueue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
            if !finished {
                finish(.failure(NSError(domain: "ProgeniaFrame", code: 408, userInfo: [
                    NSLocalizedDescriptionKey: "timeout \(host):\(portValue)"
                ])))
            }
        }
    }

    /// Scan iPhone Personal Hotspot subnet for frame TCP :83 (HTTP discovery often fails in WKWebView).
    @objc func scanFrameHosts(_ call: CAPPluginCall) {
        let portValue = call.getInt("port") ?? 83
        let timeoutMs = call.getInt("timeoutMs") ?? 600
        let hostFirst = call.getInt("hostFirst") ?? 2
        let hostLast = call.getInt("hostLast") ?? 32
        let subnet = call.getString("subnet") ?? "172.20.10"
        guard let port = NWEndpoint.Port(rawValue: UInt16(portValue)) else {
            call.reject("invalid port")
            return
        }

        var hostnames: [String] = ["progenia-frame.local"]
        if hostLast >= hostFirst {
            for i in hostFirst...hostLast {
                hostnames.append("\(subnet).\(i)")
            }
        }

        var found: [String] = []
        let lock = NSLock()
        let group = DispatchGroup()

        for host in hostnames {
            group.enter()
            let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)
            var finished = false
            let finish: (Bool) -> Void = { ok in
                lock.lock()
                defer { lock.unlock() }
                guard !finished else { return }
                finished = true
                conn.cancel()
                if ok {
                    found.append(host)
                }
                group.leave()
            }
            conn.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    finish(true)
                case .failed:
                    finish(false)
                default:
                    break
                }
            }
            conn.start(queue: ioQueue)
            ioQueue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
                finish(false)
            }
        }

        group.notify(queue: .main) {
            var seen = Set<String>()
            let ordered = found.filter { seen.insert($0).inserted }
            call.resolve(["hosts": ordered])
        }
    }

    // MARK: - Internals

    private func resolveTcpOnce(_ data: [String: Any]) {
        guard !tcpDidResolve else { return }
        tcpDidResolve = true
        let call = tcpConnectCall
        tcpConnectCall = nil
        DispatchQueue.main.async { call?.resolve(data) }
    }

    private func rejectTcpOnce(_ message: String) {
        guard !tcpDidResolve else { return }
        tcpDidResolve = true
        let call = tcpConnectCall
        tcpConnectCall = nil
        DispatchQueue.main.async { call?.reject(message) }
    }

    private func stopStreamInternal() {
        pendingDirty = false
        lineBuffer.removeAll(keepingCapacity: false)
        sampleSeq = 0
        rxCount = 0
        lastRxHz = 0
        localQuatServer.stop()
        stopBleInternal()

        udpSource?.cancel()
        udpSource = nil
        udpFd = -1

        tcpConnection?.stateUpdateHandler = nil
        tcpConnection?.cancel()
        tcpConnection = nil
        streamMode = nil
    }

    private func stopBleInternal() {
        bleTimeout?.cancel()
        bleTimeout = nil
        bleRateProbe?.cancel()
        bleRateProbe = nil
        if let central = bleCentral, let peripheral = blePeripheral {
            if let characteristic = bleOrientationCharacteristic {
                peripheral.setNotifyValue(false, for: characteristic)
            }
            central.cancelPeripheralConnection(peripheral)
        }
        bleCentral?.stopScan()
        bleOrientationCharacteristic = nil
        bleCommandCharacteristic = nil
        blePeripheral = nil
        bleCentral = nil
        bleWarmupRetries = 0
        if let pending = bleStartCall {
            bleStartCall = nil
            pending.reject("BLE stream stopped")
        }
    }

    private func drainUdp() {
        var buf = [UInt8](repeating: 0, count: 2048)
        while true {
            let n = recv(udpFd, &buf, buf.count, MSG_DONTWAIT)
            if n <= 0 { break }
            ingest(Data(buf[0..<n]))
        }
    }

    private func receiveTcp() {
        guard let connection = tcpConnection else { return }
        connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }
            if let data = data, !data.isEmpty {
                self.ingest(data)
            }
            if let error = error {
                self.notifyListeners("streamStatus", data: [
                    "state": "error",
                    "message": error.localizedDescription
                ])
                self.stopStreamInternal()
                return
            }
            if isComplete {
                self.notifyListeners("streamStatus", data: ["state": "closed"])
                self.stopStreamInternal()
                return
            }
            self.receiveTcp()
        }
    }

    private func ingest(_ data: Data) {
        lineBuffer.append(data)
        while let range = lineBuffer.range(of: Data([0x0A])) {
            let lineData = lineBuffer.subdata(in: lineBuffer.startIndex..<range.lowerBound)
            lineBuffer.removeSubrange(lineBuffer.startIndex..<range.upperBound)
            guard let line = String(data: lineData, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
                  line.hasPrefix("{"),
                  let payload = line.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
                  let w = Self.asDouble(json["w"]),
                  let x = Self.asDouble(json["x"]),
                  let y = Self.asDouble(json["y"]),
                  let z = Self.asDouble(json["z"])
            else { continue }
            let gx = Self.asDouble(json["gx"])
            let gy = Self.asDouble(json["gy"])
            let gz = Self.asDouble(json["gz"])
            let hasGravity = gx != nil && gy != nil && gz != nil
            pendingW = w
            pendingX = x
            pendingY = y
            pendingZ = z
            sampleSeq &+= 1
            pendingDirty = true
            rxCount &+= 1
            let now = Date()
            if now.timeIntervalSince(lastHzTick) >= 1.0 {
                lastRxHz = rxCount
                rxCount = 0
                lastHzTick = now
            }
            localQuatServer.broadcast(
                w: w, x: x, y: y, z: z,
                gravityX: gx ?? 0, gravityY: gy ?? 0, gravityZ: gz ?? 0,
                hasGravity: hasGravity, seq: sampleSeq
            )
        }
        if lineBuffer.count > 8192 {
            lineBuffer.removeAll(keepingCapacity: false)
        }
    }

    private static func asDouble(_ value: Any?) -> Double? {
        if let d = value as? Double { return d }
        if let n = value as? NSNumber { return n.doubleValue }
        return nil
    }

    private func ingestBlePacket(_ data: Data) {
        guard data.count == 20 else { return }
        let bytes = [UInt8](data)
        guard bytes[0] == 0xB2, bytes[1] == 0x02 else { return }

        func int16LE(_ offset: Int) -> Int16 {
            let raw = UInt16(bytes[offset]) | (UInt16(bytes[offset + 1]) << 8)
            return Int16(bitPattern: raw)
        }

        var w = Double(int16LE(6)) / 32767.0
        var x = Double(int16LE(8)) / 32767.0
        var y = Double(int16LE(10)) / 32767.0
        var z = Double(int16LE(12)) / 32767.0
        let qn = sqrt(w * w + x * x + y * y + z * z)
        guard qn > 0.5, qn < 1.5 else { return }
        w /= qn
        x /= qn
        y /= qn
        z /= qn

        let gx = Double(int16LE(14)) / 2048.0
        let gy = Double(int16LE(16)) / 2048.0
        let gz = Double(int16LE(18)) / 2048.0

        pendingW = w
        pendingX = x
        pendingY = y
        pendingZ = z
        sampleSeq &+= 1
        pendingDirty = true
        rxCount &+= 1
        let now = Date()
        if now.timeIntervalSince(lastHzTick) >= 1.0 {
            lastRxHz = rxCount
            rxCount = 0
            lastHzTick = now
        }
        localQuatServer.broadcast(
            w: w, x: x, y: y, z: z,
            gravityX: gx, gravityY: gy, gravityZ: gz,
            hasGravity: true, seq: sampleSeq
        )
    }

    private func validateBleRate(_ peripheral: CBPeripheral) {
        bleRateProbe?.cancel()
        let startSeq = sampleSeq
        let probe = DispatchWorkItem { [weak self, weak peripheral] in
            guard let self = self,
                  let peripheral = peripheral,
                  self.streamMode == "native-ble",
                  self.bleStartCall != nil else { return }

            let received = self.sampleSeq &- startSeq
            if received >= 20 {
                self.bleTimeout?.cancel()
                self.bleTimeout = nil
                self.bleRateProbe = nil
                let call = self.bleStartCall
                self.bleStartCall = nil
                call?.resolve([
                    "ok": true,
                    "mode": "native-ble",
                    "deviceId": peripheral.identifier.uuidString,
                    "name": peripheral.name ?? "ProGenia Frame"
                ])
                return
            }

            if self.bleWarmupRetries == 0, let central = self.bleCentral {
                // On affected iPhone/ESP32-C3 pairs, only a controller reboot
                // (not a plain reconnect) clears the first 1 Hz session.
                self.bleWarmupRetries = 1
                self.bleRateProbe = nil
                if let command = self.bleCommandCharacteristic {
                    peripheral.writeValue(
                        Data("REBOOT".utf8),
                        for: command,
                        type: .withoutResponse
                    )
                } else {
                    central.cancelPeripheralConnection(peripheral)
                }
                return
            }

            let call = self.bleStartCall
            self.bleStartCall = nil
            call?.reject("BLE permaneceu lento após reconexão automática.")
            self.stopBleInternal()
            self.localQuatServer.stop()
        }
        bleRateProbe = probe
        ioQueue.asyncAfter(deadline: .now() + .seconds(2), execute: probe)
    }
}

extension ProgeniaArFramePlugin: CBCentralManagerDelegate, CBPeripheralDelegate {
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard bleStartCall != nil else { return }
        switch central.state {
        case .poweredOn:
            if let target = bleTargetIdentifier,
               let peripheral = central.retrievePeripherals(withIdentifiers: [target]).first {
                blePeripheral = peripheral
                peripheral.delegate = self
                central.connect(peripheral, options: nil)
            } else {
                central.scanForPeripherals(
                    withServices: [frameServiceUUID],
                    options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
                )
            }
        case .unauthorized:
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Bluetooth sem permissão. Ative em Ajustes > ProGenia > Bluetooth.")
            stopBleInternal()
            localQuatServer.stop()
        case .unsupported:
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Bluetooth LE não suportado neste iPhone.")
            stopBleInternal()
            localQuatServer.stop()
        case .poweredOff:
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Bluetooth desligado.")
            stopBleInternal()
            localQuatServer.stop()
        default:
            break
        }
    }

    public func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        guard blePeripheral == nil else { return }
        let name = peripheral.name
            ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String
            ?? ""
        guard name.hasPrefix("ProGenia-Frame-") || !name.isEmpty else { return }
        central.stopScan()
        blePeripheral = peripheral
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.delegate = self
        peripheral.discoverServices([frameServiceUUID])
    }

    public func centralManager(
        _ central: CBCentralManager,
        didFailToConnect peripheral: CBPeripheral,
        error: Error?
    ) {
        let call = bleStartCall
        bleStartCall = nil
        call?.reject("Falha ao conectar BLE: \(error?.localizedDescription ?? "desconhecida")")
        stopBleInternal()
        localQuatServer.stop()
    }

    public func centralManager(
        _ central: CBCentralManager,
        didDisconnectPeripheral peripheral: CBPeripheral,
        error: Error?
    ) {
        guard streamMode == "native-ble" else { return }
        notifyListeners("streamStatus", data: [
            "state": "reconnecting",
            "message": error?.localizedDescription ?? "BLE desconectado"
        ])
        bleOrientationCharacteristic = nil
        bleCommandCharacteristic = nil
        ioQueue.asyncAfter(deadline: .now() + .milliseconds(500)) { [weak self, weak peripheral] in
            guard let self = self,
                  self.streamMode == "native-ble",
                  let peripheral = peripheral else { return }
            peripheral.delegate = self
            central.connect(peripheral, options: nil)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error {
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Serviço BLE: \(error.localizedDescription)")
            stopBleInternal()
            localQuatServer.stop()
            return
        }
        guard let service = peripheral.services?.first(where: { $0.uuid == frameServiceUUID }) else {
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Firmware antigo: serviço ProGenia não encontrado.")
            stopBleInternal()
            localQuatServer.stop()
            return
        }
        peripheral.discoverCharacteristics(
            [frameOrientationUUID, frameCommandUUID],
            for: service
        )
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        guard error == nil,
              let characteristic = service.characteristics?.first(where: {
                  $0.uuid == frameOrientationUUID
              }) else {
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Firmware antigo: characteristic de stream BLE ausente. Regrave a moldura.")
            stopBleInternal()
            localQuatServer.stop()
            return
        }
        bleOrientationCharacteristic = characteristic
        bleCommandCharacteristic = service.characteristics?.first(where: {
            $0.uuid == frameCommandUUID
        })
        peripheral.setNotifyValue(true, for: characteristic)
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard characteristic.uuid == frameOrientationUUID else { return }
        if let error = error {
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Não foi possível assinar o stream BLE: \(error.localizedDescription)")
            stopBleInternal()
            localQuatServer.stop()
            return
        }
        guard characteristic.isNotifying else { return }
        if bleStartCall != nil {
            validateBleRate(peripheral)
        } else {
            notifyListeners("streamStatus", data: ["state": "streaming", "mode": "native-ble"])
        }
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard error == nil,
              characteristic.uuid == frameOrientationUUID,
              let data = characteristic.value else { return }
        ingestBlePacket(data)
    }
}
