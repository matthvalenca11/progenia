import { BleClient, numbersToDataView, type ScanResult } from "@capacitor-community/bluetooth-le";
import { isNativeApp } from "@/lib/capacitor";
import {
  FRAME_COMMAND_UUID,
  FRAME_CONNECT_TIMEOUT_MS,
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

  async initialize(): Promise<void> {
    this.state = "initializing";
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
      await BleClient.initialize({ androidNeverForLocation: true });
      this.state = "idle";
    } catch (err) {
      this.state = "unsupported";
      throw err;
    }
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
      await runScan({ namePrefix: FRAME_NAME_PREFIX, allowDuplicates: true }, Math.min(timeoutMs, 5000));
      if (found.size === 0) {
        await runScan({ services: [FRAME_SERVICE_UUID], allowDuplicates: true }, Math.min(timeoutMs, 5000));
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
    try {
      const device = await BleClient.requestDevice({
        namePrefix: FRAME_NAME_PREFIX,
        services: [FRAME_SERVICE_UUID],
        optionalServices: [FRAME_SERVICE_UUID],
      });
      return {
        deviceId: device.deviceId,
        name: device.name || device.deviceId,
      };
    } catch {
      return null;
    }
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
    await this.connectInternal(deviceId);
  }

  async connectForProvision(deviceId: string): Promise<void> {
    this.orientationEnabled = false;
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
    this.state = "connecting";
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout ao conectar na moldura (10 s)")), FRAME_CONNECT_TIMEOUT_MS);
    });

    try {
      await Promise.race([BleClient.connect(deviceId, () => this.handleDisconnect()), timeout]);
      this.deviceId = deviceId;
      await BleClient.getServices(deviceId);
      this.state = "connected";
      if (this.orientationEnabled) {
        await this.attachNotify();
        this.state = "streaming";
      }
    } catch (err) {
      this.state = "error";
      this.deviceId = null;
      throw err instanceof Error ? err : new Error("Falha ao conectar BLE");
    }
  }

  async disconnect(): Promise<void> {
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

  async writeReboot(): Promise<void> {
    await this.writeCommand("REBOOT");
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

  private handleDisconnect() {
    this.notifyAttached = false;
    this.deviceId = null;
    this.state = "idle";
    this.clearPending();
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
        const q = parseOrientationPayload(value);
        if (!q) return;
        this.pendingSample = { ...q, receivedAt: performance.now() };
        if (!this.rafId) {
          this.rafId = requestAnimationFrame(this.flushPending);
        }
      },
    );
    this.notifyAttached = true;
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
