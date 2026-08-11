import type { PluginListenerHandle } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import type { OrientationSample } from "@/features/ar-slice/ble/protocol";
import { ProgeniaArFrame } from "@/features/ar-slice/vision/ProgeniaArFrame";
import {
  FRAME_WIFI_DEFAULT_HOST,
  FRAME_WIFI_HOST_CANDIDATES,
  FRAME_WIFI_PASSWORD,
  FRAME_WIFI_POLL_MS,
  FRAME_WIFI_RAW_PORT,
  FRAME_WIFI_SSID_PREFIX,
  FRAME_WIFI_STA_HOST_CANDIDATES,
  FRAME_WIFI_UDP_PORT,
  frameWifiHttpUrl,
  frameWifiStreamUrl,
} from "@/features/ar-slice/wifi/protocol";
import {
  LOCAL_QUAT_WS_URL,
  parseLocalQuatFrame,
} from "@/features/ar-slice/wifi/localQuatWs";
import {
  fetchFrameStatus,
  buildStaticHostCandidates,
  scanNativeFrameHosts,
  pingFrameHealth,
  postFrameSta,
} from "@/features/ar-slice/wifi/frameHttpPing";

export type WifiClientState = "idle" | "connecting" | "streaming" | "error";
export type WifiStreamMode = "native-udp" | "native-tcp" | "xhr-stream" | "poll" | null;
export type WifiConnectProgress = (message: string) => void;

type QuatJson = {
  w: number;
  x: number;
  y: number;
  z: number;
  gx?: number;
  gy?: number;
  gz?: number;
  ax?: number;
  ay?: number;
  az?: number;
  wx?: number;
  wy?: number;
  wz?: number;
  dp?: number;
  dpx?: number;
  dpy?: number;
  dpz?: number;
};

/**
 * STA orientation client (Personal Hotspot + ESP UDP :9091).
 * iOS native: UDP → ProgeniaLocalQuatServer → ws://127.0.0.1:19091 (bypasses throttled bridge).
 */
export class WifiOrientationClient {
  private state: WifiClientState = "idle";
  private listeners = new Set<(sample: OrientationSample) => void>();
  private host = FRAME_WIFI_DEFAULT_HOST;
  private stopped = true;
  private mode: WifiStreamMode = null;
  private lastError: string | null = null;
  private xhr: XMLHttpRequest | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private consumed = 0;
  private lineBuf = "";
  private nativeHandles: PluginListenerHandle[] = [];
  private sampleWatchdog: ReturnType<typeof setInterval> | null = null;
  private diagPullTimer: ReturnType<typeof setInterval> | null = null;
  private lastNativeSampleAt = 0;
  private lastSeq = 0;
  private localWs: WebSocket | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private nativeRxHz = 0;
  private wsTxHz = 0;
  private espMode: string | null = null;

  getState() {
    return this.state;
  }

  getHost() {
    return this.host;
  }

  getMode() {
    return this.mode;
  }

  getLastError() {
    return this.lastError;
  }

  getNativeRxHz() {
    return this.nativeRxHz;
  }

  getWsTxHz() {
    return this.wsTxHz;
  }

  getEspMode() {
    return this.espMode;
  }

  static async clearSavedHost(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key: "ar-slice:lastWifiHost" });
    } catch {
      // ignore
    }
  }

  static connectionHint(ssidSuffix = "XXXX") {
    return {
      ssid: `${FRAME_WIFI_SSID_PREFIX}${ssidSuffix}`,
      password: FRAME_WIFI_PASSWORD,
      url: frameWifiStreamUrl(),
    };
  }

  subscribe(cb: (sample: OrientationSample) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  static async discoverHost(preferred?: string): Promise<string> {
    const hosts = await WifiOrientationClient.discoverHosts(preferred);
    return hosts[0];
  }

  /** Build ordered host list — native scan + static candidates (never blocks on HTTP). */
  static async discoverHosts(preferred?: string, onProgress?: WifiConnectProgress): Promise<string[]> {
    let lastHost: string | undefined;
    if (Capacitor.isNativePlatform()) {
      try {
        const { Preferences } = await import("@capacitor/preferences");
        const saved = await Preferences.get({ key: "ar-slice:lastWifiHost" });
        if (saved.value) lastHost = saved.value;
      } catch {
        // ignore
      }
      if (lastHost === FRAME_WIFI_DEFAULT_HOST) lastHost = undefined;
    }

    const staticHosts = buildStaticHostCandidates(preferred, lastHost).filter(
      (h) => Capacitor.isNativePlatform() && preferred !== FRAME_WIFI_DEFAULT_HOST
        ? h !== FRAME_WIFI_DEFAULT_HOST
        : true,
    );

    if (Capacitor.isNativePlatform()) {
      onProgress?.("Procurando moldura na rede local…");
      const scanned = await scanNativeFrameHosts(onProgress);
      if (scanned.length > 0) {
        onProgress?.(`Encontrado: ${scanned.join(", ")}`);
        return [...new Set([...scanned, ...staticHosts])];
      }
      onProgress?.("Scan vazio — tentando hosts conhecidos…");
      return staticHosts;
    }

    const hits = await Promise.all(
      staticHosts.map(async (h) => {
        try {
          await pingFrameHealth(h, 2000);
          return h;
        } catch {
          return null;
        }
      }),
    );
    const found = hits.filter((h): h is string => Boolean(h));
    if (found.length === 0) {
      throw new Error(
        "Moldura não encontrada. Ligue o Personal Hotspot e aguarde ~15 s.",
      );
    }
    return found;
  }

  async connect(host?: string, onProgress?: WifiConnectProgress): Promise<void> {
    await this.disconnectAsync();
    this.state = "connecting";
    this.stopped = false;
    this.consumed = 0;
    this.lineBuf = "";
    this.lastError = null;
    this.lastNativeSampleAt = 0;
    this.lastSeq = 0;

    const candidates = host?.trim()
      ? [host.trim()]
      : await WifiOrientationClient.discoverHosts(undefined, onProgress);

    if (Capacitor.isNativePlatform()) {
      const errors: string[] = [];
      for (const candidate of candidates) {
        this.host = candidate;
        onProgress?.(`Testando ${candidate}…`);
        try {
          await this.tryConnectCandidate(onProgress);
          this.state = "streaming";
          this.armSampleWatchdog();
          await this.persistHost(this.host);
          onProgress?.(`Conectado (${this.mode} @ ${this.host})`);
          return;
        } catch (err) {
          errors.push(`${candidate}: ${err instanceof Error ? err.message : String(err)}`);
          await this.clearNative();
          this.lastNativeSampleAt = 0;
          this.lastSeq = 0;
        }
      }

      this.lastError = errors.join(" | ");
      this.state = "error";
      throw new Error(
        `Não conectou (${this.lastError}). Hotspot ligado com 1 cliente? Permita Rede Local. Aguarde ~20 s após gravar via BLE.`,
      );
    }

    this.host = candidates[0];
    await this.loadEspMode(onProgress);

    try {
      await this.startXhrStream();
      this.mode = "xhr-stream";
      this.state = "streaming";
      return;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }

    await this.fetchQuatOnce(8000);
    this.mode = "poll";
    this.state = "streaming";
    this.schedulePoll(0);
  }

  /** TCP :83 then UDP :9091 on the same host. */
  private async tryConnectCandidate(onProgress?: WifiConnectProgress): Promise<void> {
    await this.loadEspMode(onProgress);
    if (this.espMode === "softap") {
      throw new Error("modo softap (~1 Hz) — reprovisione o hotspot");
    }

    const modes: Array<"native-tcp" | "native-udp"> = ["native-tcp", "native-udp"];
    const modeErrors: string[] = [];
    for (const mode of modes) {
      try {
        await this.tryNativeStream(mode, onProgress);
        return;
      } catch (err) {
        modeErrors.push(err instanceof Error ? err.message : String(err));
        await this.clearNative();
        this.lastNativeSampleAt = 0;
        this.lastSeq = 0;
      }
    }
    throw new Error(modeErrors.join(" · "));
  }

  private async tryNativeStream(mode: "native-tcp" | "native-udp", onProgress?: WifiConnectProgress): Promise<void> {
    await this.attachStatusListener();
    if (mode === "native-tcp") {
      onProgress?.(`Abrindo TCP :${FRAME_WIFI_RAW_PORT} em ${this.host}…`);
      await ProgeniaArFrame.startTcpStream({ host: this.host, port: FRAME_WIFI_RAW_PORT });
    } else {
      onProgress?.("Abrindo UDP :9091…");
      await ProgeniaArFrame.startUdpStream({ port: FRAME_WIFI_UDP_PORT });
    }
    onProgress?.("Conectando WebSocket local…");
    await this.openLocalWebSocket();
    this.startDiagPull();
    onProgress?.("Aguardando stream (~40 Hz)…");
    await this.waitForMinSampleRate(6, 10_000);
    this.mode = mode;
  }

  private async loadEspMode(onProgress?: WifiConnectProgress) {
    const status = await fetchFrameStatus(this.host, 2000);
    this.espMode = status?.mode ?? null;
    if (status?.mode) onProgress?.(`ESP modo ${status.mode} @ ${this.host}`);
    if (Capacitor.isNativePlatform() && status?.mode === "softap") {
      throw new Error("ESP em SoftAP — reprovisione o hotspot");
    }
  }

  private openLocalWebSocket(): Promise<void> {
    this.closeLocalWebSocket(false);
    return this.openLocalWebSocketUrl(LOCAL_QUAT_WS_URL).catch(() =>
      this.openLocalWebSocketUrl("ws://localhost:19091"),
    );
  }

  private openLocalWebSocketUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      let settled = false;

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        ws.close();
        reject(new Error(message));
      };

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        this.localWs = ws;
        resolve();
      };

      ws.onerror = () => fail("WebSocket local falhou (127.0.0.1:19091)");

      ws.onclose = () => {
        if (!settled) fail("WebSocket local fechou antes de abrir");
        if (this.localWs === ws) this.localWs = null;
        this.scheduleWsReconnect();
      };

      ws.onmessage = (ev) => {
        if (!(ev.data instanceof ArrayBuffer)) return;
        const frame = parseLocalQuatFrame(ev.data);
        if (!frame || frame.seq === this.lastSeq) return;
        this.lastSeq = frame.seq;
        this.lastNativeSampleAt = performance.now();
        this.emit({
          w: frame.w,
          x: frame.x,
          y: frame.y,
          z: frame.z,
          ...(frame.gravity
            ? { gx: frame.gravity.x, gy: frame.gravity.y, gz: frame.gravity.z }
            : {}),
          ...(frame.translationPosition != null ? { dp: frame.translationPosition } : {}),
        });
      };

      window.setTimeout(() => {
        if (!settled && ws.readyState !== WebSocket.OPEN) {
          fail("timeout abrindo WebSocket local");
        }
      }, 3000);
    });
  }

  private scheduleWsReconnect() {
    if (this.stopped || (this.mode !== "native-udp" && this.mode !== "native-tcp") || this.wsReconnectTimer) {
      return;
    }
    this.wsReconnectTimer = window.setTimeout(() => {
      this.wsReconnectTimer = null;
      if (this.stopped || (this.mode !== "native-udp" && this.mode !== "native-tcp")) return;
      void this.openLocalWebSocket().catch(() => this.scheduleWsReconnect());
    }, 400);
  }

  private closeLocalWebSocket(clearReconnect = true) {
    if (clearReconnect && this.wsReconnectTimer) {
      window.clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.localWs) {
      this.localWs.onopen = null;
      this.localWs.onmessage = null;
      this.localWs.onerror = null;
      this.localWs.onclose = null;
      this.localWs.close();
      this.localWs = null;
    }
  }

  /** Sparse native poll for rxHz/wsTxHz diagnostics — do not hammer Capacitor bridge. */
  private startDiagPull() {
    if (this.diagPullTimer) clearInterval(this.diagPullTimer);
    this.diagPullTimer = setInterval(() => {
      if (this.stopped) return;
      void ProgeniaArFrame.pollOrientation()
        .then((s) => {
          if (typeof s?.rxHz === "number") this.nativeRxHz = s.rxHz;
          if (typeof s?.wsTxHz === "number") this.wsTxHz = s.wsTxHz;
        })
        .catch(() => {});
    }, 1000);
  }

  private async persistHost(host: string) {
    if (!Capacitor.isNativePlatform()) return;
    if (host === FRAME_WIFI_DEFAULT_HOST) return;
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: "ar-slice:lastWifiHost", value: host });
    } catch {
      // ignore
    }
  }

  private armSampleWatchdog() {
    if (this.sampleWatchdog) clearInterval(this.sampleWatchdog);
    this.sampleWatchdog = setInterval(() => {
      if (this.stopped) return;
      if (performance.now() - this.lastNativeSampleAt > 2500) {
        this.lastError = `${this.mode}: sem samples >2.5s`;
      }
    }, 1000);
  }

  /** Reject slow streams (~1 Hz UDP on hotspot passes "first sample" but feels broken). */
  private waitForMinSampleRate(minSamples: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const started = performance.now();
      let samples = 0;
      let lastSeenSeq = this.lastSeq;
      const iv = window.setInterval(() => {
        if (this.lastSeq !== lastSeenSeq) {
          samples += 1;
          lastSeenSeq = this.lastSeq;
        }
        const elapsed = performance.now() - started;
        if (elapsed >= 1200 && samples >= minSamples) {
          window.clearInterval(iv);
          resolve();
          return;
        }
        if (elapsed > timeoutMs) {
          window.clearInterval(iv);
          reject(
            new Error(
              `só ${samples} samples em ${(elapsed / 1000).toFixed(1)}s (precisa ≥${minSamples} em ~2s)`,
            ),
          );
        }
      }, 40);
    });
  }

  private async attachStatusListener() {
    await this.clearNativeListeners();
    const statusHandle = await ProgeniaArFrame.addListener("streamStatus", (status) => {
      if (this.stopped) return;
      if (status.state === "error" || status.state === "closed") {
        this.lastError = status.message ?? status.state;
        this.state = "error";
      }
    });
    this.nativeHandles = [statusHandle];
  }

  private async clearNativeListeners() {
    for (const h of this.nativeHandles) {
      try {
        await h.remove();
      } catch {
        // ignore
      }
    }
    this.nativeHandles = [];
  }

  private async clearNative() {
    if (this.sampleWatchdog) {
      clearInterval(this.sampleWatchdog);
      this.sampleWatchdog = null;
    }
    if (this.diagPullTimer) {
      clearInterval(this.diagPullTimer);
      this.diagPullTimer = null;
    }
    this.closeLocalWebSocket();
    await this.clearNativeListeners();
    try {
      await ProgeniaArFrame.stopStream();
    } catch {
      // ignore
    }
  }

  /** Save iPhone hotspot creds on the frame. Reboots ESP into STA. */
  async provisionSta(ssid: string, pass = FRAME_WIFI_PASSWORD, host?: string): Promise<void> {
    const target = host || this.host || FRAME_WIFI_DEFAULT_HOST;
    await postFrameSta(target, ssid, pass);
  }

  private emit(q: QuatJson) {
    if (![q.w, q.x, q.y, q.z].every((n) => typeof n === "number" && Number.isFinite(n))) return;
    const hasGravity =
      [q.gx, q.gy, q.gz].every((n) => typeof n === "number" && Number.isFinite(n));
    const hasLinear =
      [q.ax, q.ay, q.az].every((n) => typeof n === "number" && Number.isFinite(n));
    const hasGyro =
      [q.wx, q.wy, q.wz].every((n) => typeof n === "number" && Number.isFinite(n));
    const sample: OrientationSample = {
      w: q.w,
      x: q.x,
      y: q.y,
      z: q.z,
      receivedAt: performance.now(),
      ...(hasGravity ? { gravity: { x: q.gx!, y: q.gy!, z: q.gz! } } : {}),
      ...(hasLinear ? { linearAccel: { x: q.ax!, y: q.ay!, z: q.az! } } : {}),
      ...(hasGyro ? { gyro: { x: q.wx!, y: q.wy!, z: q.wz! } } : {}),
      ...(typeof q.dp === "number" && Number.isFinite(q.dp)
        ? { translationPosition: q.dp }
        : {}),
      ...([q.dpx, q.dpy, q.dpz].every((n) => typeof n === "number" && Number.isFinite(n))
        ? { translationWorld: { x: q.dpx!, y: q.dpy!, z: q.dpz! } }
        : {}),
    };
    this.listeners.forEach((cb) => cb(sample));
  }

  private ingestText(chunk: string) {
    this.lineBuf += chunk;
    let nl = this.lineBuf.indexOf("\n");
    while (nl >= 0) {
      const line = this.lineBuf.slice(0, nl).trim();
      this.lineBuf = this.lineBuf.slice(nl + 1);
      if (line) {
        try {
          this.emit(JSON.parse(line) as QuatJson);
        } catch {
          // ignore
        }
      }
      nl = this.lineBuf.indexOf("\n");
    }
  }

  private startXhrStream(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = frameWifiStreamUrl(this.host);
      const xhr = new XMLHttpRequest();
      this.xhr = xhr;
      this.consumed = 0;
      this.lineBuf = "";

      let opened = false;
      const failTimer = window.setTimeout(() => {
        if (!opened) {
          xhr.abort();
          reject(new Error("timeout abrindo stream :82"));
        }
      }, 5000);

      xhr.open("GET", url, true);
      xhr.setRequestHeader("Accept", "application/x-ndjson, text/plain, */*");
      xhr.responseType = "text";

      const onChunk = () => {
        const text = xhr.responseText || "";
        if (text.length > this.consumed) {
          if (!opened) {
            opened = true;
            window.clearTimeout(failTimer);
            resolve();
          }
          const chunk = text.slice(this.consumed);
          this.consumed = text.length;
          this.ingestText(chunk);
        }
      };

      xhr.onprogress = onChunk;
      xhr.onreadystatechange = () => {
        if (xhr.readyState >= 3) onChunk();
      };
      xhr.onerror = () => {
        window.clearTimeout(failTimer);
        if (!opened) reject(new Error("xhr stream error"));
      };
      xhr.onabort = () => window.clearTimeout(failTimer);
      xhr.onload = () => window.clearTimeout(failTimer);

      try {
        xhr.send();
      } catch (err) {
        window.clearTimeout(failTimer);
        reject(err instanceof Error ? err : new Error("xhr send failed"));
      }
    });
  }

  private schedulePoll(delay: number) {
    if (this.stopped || this.mode !== "poll") return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.pollTick(), delay);
  }

  private async pollTick() {
    if (this.stopped || this.mode !== "poll") return;
    const t0 = performance.now();
    try {
      await this.fetchQuatOnce(2000);
    } catch {
      // keep trying
    }
    if (!this.stopped && this.mode === "poll") {
      this.schedulePoll(Math.max(0, FRAME_WIFI_POLL_MS - (performance.now() - t0)));
    }
  }

  private async fetchQuatOnce(timeoutMs: number) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(frameWifiHttpUrl("/quat", this.host), {
        signal: ctrl.signal,
        cache: "no-store",
        mode: "cors",
      });
      if (!res.ok) throw new Error(`quat ${res.status}`);
      this.emit((await res.json()) as QuatJson);
    } finally {
      window.clearTimeout(timer);
    }
  }

  async writeZero() {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(frameWifiHttpUrl("/zero", this.host), {
        method: "POST",
        signal: ctrl.signal,
        cache: "no-store",
        mode: "cors",
      });
      if (!res.ok) throw new Error("ZERO falhou");
    } finally {
      window.clearTimeout(timer);
    }
  }

  disconnect() {
    void this.disconnectAsync();
  }

  async disconnectAsync(): Promise<void> {
    this.stopped = true;
    await this.clearNative();
    if (this.xhr) {
      try {
        this.xhr.abort();
      } catch {
        // ignore
      }
      this.xhr = null;
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.mode = null;
    this.state = "idle";
    this.consumed = 0;
    this.lineBuf = "";
    this.lastSeq = 0;
    this.lastNativeSampleAt = 0;
    this.nativeRxHz = 0;
    this.wsTxHz = 0;
    this.espMode = null;
  }
}
