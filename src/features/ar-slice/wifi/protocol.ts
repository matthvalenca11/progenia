/** SoftAP / STA stream — iOS hotspot: native TCP :83 + local WS (UDP gateway often ~1 Hz) */
export const FRAME_WIFI_DEFAULT_HOST = "192.168.4.1";
export const FRAME_WIFI_MDNS_HOST = "progenia-frame.local";
export const FRAME_WIFI_PASSWORD = "progenia1";
export const FRAME_WIFI_SSID_PREFIX = "ProGenia-Frame-";
/** WKWebView HTTP stream (buffered ~1 Hz on iOS) */
export const FRAME_WIFI_STREAM_PORT = 82;
/** Native TCP NDJSON */
export const FRAME_WIFI_RAW_PORT = 83;
/** Native UDP NDJSON */
export const FRAME_WIFI_UDP_PORT = 9091;
/** Poll backup — native UDP inject is primary; pull latest sample at ~60 Hz */
export const FRAME_WIFI_POLL_MS = 16;

/** Prefer STA / Personal Hotspot before SoftAP (SoftAP ≈ 1–2 Hz on iOS) */
export const FRAME_WIFI_STA_HOST_CANDIDATES = [
  FRAME_WIFI_MDNS_HOST,
  "172.20.10.2",
  "172.20.10.3",
  "172.20.10.4",
  "172.20.10.5",
  "172.20.10.6",
  "172.20.10.7",
  "172.20.10.8",
] as const;

/** Hosts to try when connecting (STA first on native, then SoftAP fallback) */
export const FRAME_WIFI_HOST_CANDIDATES = [
  ...FRAME_WIFI_STA_HOST_CANDIDATES,
  FRAME_WIFI_DEFAULT_HOST,
] as const;

export function frameWifiHttpUrl(path: string, host = FRAME_WIFI_DEFAULT_HOST) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `http://${host}${p}`;
}

export function frameWifiStreamUrl(host = FRAME_WIFI_DEFAULT_HOST) {
  return `http://${host}:${FRAME_WIFI_STREAM_PORT}/`;
}

export type FrameEspStatus = {
  mode?: string;
  ip?: string;
  gw?: string;
  ssid?: string;
  udp?: number;
  seq?: number;
};
