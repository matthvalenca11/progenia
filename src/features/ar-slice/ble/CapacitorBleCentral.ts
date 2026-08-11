import { BleClient, numbersToDataView, type ScanResult } from "@capacitor-community/bluetooth-le";
import { isIPadDevice, isNativeApp } from "@/lib/capacitor";
import {
  FRAME_COMMAND_UUID,
  FRAME_CONNECT_TIMEOUT_MS,
  FRAME_CONN_FAST_COMMAND,
  FRAME_NAME_PREFIX,
  FRAME_ORIENTATION_UUID,
  FRAME_PROVISION_UUID,
  FRAME_SERVICE_UUID,
  FRAME_ZERO_COMMAND,
  parseOrientationPayload,
  type OrientationSample,
} from "@/features/ar-slice/ble/protocol";
import type { BleCentral, BleConnectionState, BleDeviceInfo } from "@/features/ar-slice/ble/types";

function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

function matchesFrameAdvertisement(result: ScanResult): boolean {
  const name = (result.device.name || result.localName || "").trim();
  if (name.startsWith(FRAME_NAME_PREFIX)) return true;
  const target = normalizeUuid(FRAME_SERVICE_UUID);
  return (result.uuids ?? []).some((u) => normalizeUuid(u).includes(target.slice(0, 8)));
}

export class CapacitorBleCentral implements BleCentral {
  readonly kind = "capacitor" as const;

  private state: BleConnectionState = "idle";
  private deviceId: string | null = null;
  private listeners = new Set<(sample: OrientationSample) => void>();
  private notifyAttached = false;
  private orientationEnabled = true;
  private pendingSample: OrientationSample | null = null;
  private rafId = 0;
  private shouldReconnect = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private dataWatchdog: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private initializePromise: Promise<void> | null = null;
  private lastNotificationAt = 0;
  private recoveryInProgress = false;
  /** Notify count in the current 1 s window (pre-RAF coalesce). */
  private notifyCountWindow = 0;
  private lastHzAt = 0;
  private lastRxHz = 0;
  private nativeRelayActive = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializePromise) return this.initializePromise;

    this.state = "initializing";
    this.initializePromise = (async () => {
      try {
        if (
          typeof window !== "undefined" &&
          !("bluetooth" in navigator) &&
          !isNativeApp
        ) {
          throw new Error(
            "Web Bluetooth não disponível. Use Chrome ou Edge em localhost/HTTPS.",
          );
        }
        // The iOS plugin creates a new DeviceManager/CBCentralManager on every
        // initialize call. This must run exactly once for this client lifetime.
        await BleClient.initialize({ androidNeverForLocation: true });
        this.initialized = true;
        this.state = "idle";
      } catch (err) {
        this.state = "unsupported";
        throw err;
      } finally {
        this.initializePromise = null;
      }
    })();
    return this.initializePromise;
  }

  async scan(timeoutMs = 12_000): Promise<BleDeviceInfo[]> {
    if (this.state === "unsupported") {
      throw new Error("Bluetooth LE não disponível neste dispositivo");
    }

    await this.stopScan();
    this.state = "scanning";
    const found = new Map<string, BleDeviceInfo>();

    const collect = (result: ScanResult) => {
      if (!matchesFrameAdvertisement(result)) return;
      const name = result.device.name || result.localName || FRAME_NAME_PREFIX;
      found.set(result.device.deviceId, {
        deviceId: result.device.deviceId,
        name,
        rssi: result.rssi,
      });
    };

    const runScan = async (options: Parameters<typeof BleClient.requestLEScan>[0], ms: number) => {
      await BleClient.requestLEScan(options, collect);
      await new Promise((r) => setTimeout(r, ms));
      await BleClient.stopLEScan();
    };

    try {
      // Service UUID first — fresh iPads often have nil peripheral.name until
      // after the first successful connect (namePrefix scan would miss them).
      await runScan({ services: [FRAME_SERVICE_UUID], allowDuplicates: true }, Math.min(timeoutMs, 5000));
      if (found.size === 0) {
        await runScan({ namePrefix: FRAME_NAME_PREFIX, allowDuplicates: true }, Math.min(timeoutMs, 5000));
      }
      if (found.size === 0) {
        await runScan({ allowDuplicates: true }, Math.min(timeoutMs, 5000));
      }
    } catch (err) {
      try {
        await BleClient.stopLEScan();
      } catch {
        // ignore
      }
      this.state = "error";
      throw err;
    }

    this.state = "idle";
    return Array.from(found.values()).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
  }

  async pickDevice(): Promise<BleDeviceInfo | null> {
    if (this.state === "unsupported") {
      throw new Error("Bluetooth LE não disponível neste dispositivo");
    }
    await this.stopScan();
    // iOS Capacitor filters namePrefix against peripheral.name only (not the
    // advertisement local name). On a fresh iPad that field is often nil until
    // after the first connect — so namePrefix alone hides ProGenia-Frame-*.
    // Service UUID advertising is the reliable discovery key (same as desktop
    // Web Bluetooth). Fall back to namePrefix for phones that already cached the name.
    const attempts: Parameters<typeof BleClient.requestDevice>[0][] = [
      {
        services: [FRAME_SERVICE_UUID],
        optionalServices: [FRAME_SERVICE_UUID],
      },
      {
        namePrefix: FRAME_NAME_PREFIX,
        optionalServices: [FRAME_SERVICE_UUID],
      },
    ];
    for (const options of attempts) {
      try {
        const device = await BleClient.requestDevice(options);
        return {
          deviceId: device.deviceId,
          name: device.name || device.deviceId,
        };
      } catch {
        // cancelled or none found — try the next filter strategy
      }
    }
    return null;
  }

  async stopScan(): Promise<void> {
    try {
      await BleClient.stopLEScan();
    } catch {
      // ignore
    }
    if (this.state === "scanning") this.state = "idle";
  }

  async connect(deviceId: string): Promise<void> {
    this.orientationEnabled = true;
    this.shouldReconnect = true;
    await this.connectInternal(deviceId);
  }

  async connectForProvision(deviceId: string): Promise<void> {
    this.orientationEnabled = false;
    this.shouldReconnect = false;
    await this.connectInternal(deviceId);
  }

  async provisionWifi(ssid: string, pass: string): Promise<void> {
    if (!this.deviceId) throw new Error("Nenhuma moldura conectada");
    const payload = JSON.stringify({ ssid: ssid.trim(), pass: pass || "progenia1" });
    const bytes = Array.from(new TextEncoder().encode(payload));
    await BleClient.writeWithoutResponse(
      this.deviceId,
      FRAME_SERVICE_UUID,
      FRAME_PROVISION_UUID,
      numbersToDataView(bytes),
    );
  }

  private async connectInternal(deviceId: string): Promise<void> {
    await this.stopScan();
    if (isIPadDevice()) {
      // Let CoreBluetooth finish requestDevice/scan dismissal before connect.
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    this.state = "connecting";
    const connectTimeoutMs = isIPadDevice() ? 45_000 : FRAME_CONNECT_TIMEOUT_MS;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(
              `Timeout ao conectar na moldura (${Math.round(connectTimeoutMs / 1000)} s)`,
            ),
          ),
        connectTimeoutMs,
      );
    });

    try {
      await Promise.race([
        BleClient.connect(
          deviceId,
          () => this.handleDisconnect(deviceId),
          { timeout: connectTimeoutMs },
        ),
        timeout,
      ]);
      this.deviceId = deviceId;
      await BleClient.getServices(deviceId);
      this.state = "connected";
      this.reconnectAttempt = 0;
      this.notifyCountWindow = 0;
      this.lastRxHz = 0;
      this.lastHzAt = performance.now();
      if (this.orientationEnabled) {
        await this.attachNotify();
        this.state = "streaming";
      }
    } catch (err) {
      // Promise.race does not cancel the native CoreBluetooth attempt. Explicit
      // cancellation prevents a timed-out attempt from poisoning the next one.
      try {
        await BleClient.disconnect(deviceId);
      } catch {
        // It may never have reached connected state.
      }
      this.state = "error";
      this.deviceId = null;
      throw err instanceof Error ? err : new Error("Falha ao conectar BLE");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.nativeRelayActive = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopDataWatchdog();
    const id = this.deviceId;
    await this.detachNotify();
    if (id) {
      try {
        await BleClient.disconnect(id);
      } catch {
        // ignore
      }
    }
    this.deviceId = null;
    this.state = "idle";
  }

  subscribeOrientation(cb: (sample: OrientationSample) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async writeZero(): Promise<void> {
    await this.writeCommand(FRAME_ZERO_COMMAND);
  }

  async writeConnFast(): Promise<void> {
    await this.writeCommand(FRAME_CONN_FAST_COMMAND);
  }

  getRxHz(): number {
    return this.lastRxHz;
  }

  setNativeRelayActive(active: boolean): void {
    this.nativeRelayActive = active;
    if (active) {
      this.stopDataWatchdog();
    } else if (this.state === "streaming") {
      this.startDataWatchdog();
    }
  }

  async writeReboot(): Promise<void> {
    // The caller reconnects after the frame finishes rebooting.
    this.shouldReconnect = false;
    await this.writeCommand("REBOOT");
  }

  async writeCalibrationCommand(command: "CAL_START" | "CAL_CANCEL" | "CAL_SAVE"): Promise<void> {
    await this.writeCommand(command);
  }

  private async writeCommand(command: string): Promise<void> {
    if (!this.deviceId) throw new Error("Nenhuma moldura conectada");
    const bytes = Array.from(new TextEncoder().encode(command));
    await BleClient.writeWithoutResponse(
      this.deviceId,
      FRAME_SERVICE_UUID,
      FRAME_COMMAND_UUID,
      numbersToDataView(bytes),
    );
  }

  getConnectionState(): BleConnectionState {
    return this.state;
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  private handleDisconnect(deviceId: string) {
    this.stopDataWatchdog();
    this.recoveryInProgress = false;
    this.notifyAttached = false;
    this.deviceId = null;
    this.lastRxHz = 0;
    this.state = this.shouldReconnect ? "reconnecting" : "idle";
    this.clearPending();
    if (this.shouldReconnect) this.scheduleReconnect(deviceId);
  }

  private scheduleReconnect(deviceId: string) {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(
      8_000,
      500 * 2 ** Math.min(this.reconnectAttempt, 4),
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldReconnect) return;
      void this.connectInternal(deviceId).catch(() => {
        this.scheduleReconnect(deviceId);
      });
    }, delay);
  }

  private startDataWatchdog() {
    this.stopDataWatchdog();
    if (this.nativeRelayActive) return;
    this.lastNotificationAt = performance.now();
    this.dataWatchdog = setInterval(() => {
      const id = this.deviceId;
      if (
        !id ||
        this.nativeRelayActive ||
        this.state !== "streaming" ||
        this.recoveryInProgress
      ) {
        return;
      }

      const silenceMs = performance.now() - this.lastNotificationAt;
      // Never tear down a link merely because JS sees a low rate. On iPad that
      // can be Capacitor/WKWebView batching, not a dead BLE connection. Only
      // recover from complete silence.
      if (silenceMs <= 6_000) return;

      this.recoveryInProgress = true;
      this.shouldReconnect = true;
      this.state = "reconnecting";

      const kick = async () => {
        try {
          await BleClient.disconnect(id);
        } catch {
          // ignore
        } finally {
          if (this.deviceId === id) this.handleDisconnect(id);
        }
      };
      void kick();
    }, 2_000);
  }

  private stopDataWatchdog() {
    if (this.dataWatchdog) {
      clearInterval(this.dataWatchdog);
      this.dataWatchdog = null;
    }
  }

  private clearPending() {
    this.pendingSample = null;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private flushPending = () => {
    this.rafId = 0;
    const sample = this.pendingSample;
    this.pendingSample = null;
    if (!sample) return;
    this.listeners.forEach((cb) => cb(sample));
  };

  private async attachNotify() {
    if (!this.deviceId || this.notifyAttached) return;
    await BleClient.startNotifications(
      this.deviceId,
      FRAME_SERVICE_UUID,
      FRAME_ORIENTATION_UUID,
      (value) => {
        const now = performance.now();
        this.lastNotificationAt = now;
        this.recoveryInProgress = false;
        this.notifyCountWindow += 1;
        if (now - this.lastHzAt >= 1_000) {
          this.lastRxHz = this.notifyCountWindow;
          this.notifyCountWindow = 0;
          this.lastHzAt = now;
        }
        const q = parseOrientationPayload(value);
        if (!q) return;
        this.pendingSample = { ...q, receivedAt: now };
        if (!this.rafId) {
          this.rafId = requestAnimationFrame(this.flushPending);
        }
      },
      { timeout: isIPadDevice() ? 15_000 : 5_000 },
    );
    this.notifyAttached = true;
    this.shouldReconnect = true;
    try {
      await this.writeConnFast();
    } catch {
      // Non-fatal — firmware may still boost on CCCD.
    }
    this.startDataWatchdog();
  }

  private async detachNotify() {
    this.clearPending();
    if (!this.deviceId || !this.notifyAttached) return;
    try {
      await BleClient.stopNotifications(this.deviceId, FRAME_SERVICE_UUID, FRAME_ORIENTATION_UUID);
    } catch {
      // ignore
    }
    this.notifyAttached = false;
  }
}
