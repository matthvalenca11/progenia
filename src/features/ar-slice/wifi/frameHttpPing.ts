import { Capacitor } from "@capacitor/core";
import { Http } from "@capacitor-community/http";
import { ProgeniaArFrame } from "@/features/ar-slice/vision/ProgeniaArFrame";
import {
  FRAME_WIFI_RAW_PORT,
  FRAME_WIFI_STA_HOST_CANDIDATES,
  frameWifiHttpUrl,
  type FrameEspStatus,
} from "@/features/ar-slice/wifi/protocol";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
    }),
  ]);
}

/** Native TCP :83 first — Capacitor HTTP can hang on hotspot LAN. */
export async function pingFrameHealth(host: string, timeoutMs: number): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await ProgeniaArFrame.pingHost({ host, port: FRAME_WIFI_RAW_PORT, timeoutMs });
    return;
  }

  const url = frameWifiHttpUrl("/health", host);
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", mode: "cors" });
    if (!res.ok) throw new Error(`health ${res.status}`);
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchFrameStatus(host: string, timeoutMs: number): Promise<FrameEspStatus | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await withTimeout(
        Http.get({
          url: frameWifiHttpUrl("/status", host),
          connectTimeout: timeoutMs,
          readTimeout: timeoutMs,
        }),
        timeoutMs + 500,
      );
      if (res.status !== 200) return null;
      return (typeof res.data === "string" ? JSON.parse(res.data) : res.data) as FrameEspStatus;
    } catch {
      return null;
    }
  }

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(frameWifiHttpUrl("/status", host), {
      signal: ctrl.signal,
      cache: "no-store",
      mode: "cors",
    });
    if (!res.ok) return null;
    return (await res.json()) as FrameEspStatus;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function scanNativeFrameHosts(onProgress?: (msg: string) => void): Promise<string[]> {
  if (!Capacitor.isNativePlatform()) return [];
  onProgress?.("Varrendo hotspot (TCP :83)…");
  try {
    const { hosts } = await ProgeniaArFrame.scanFrameHosts({
      port: FRAME_WIFI_RAW_PORT,
      timeoutMs: 700,
      subnet: "172.20.10",
      hostFirst: 2,
      hostLast: 32,
    });
    return hosts ?? [];
  } catch {
    return [];
  }
}

export async function postFrameSta(
  host: string,
  ssid: string,
  pass: string,
  timeoutMs = 8000,
): Promise<void> {
  const url = frameWifiHttpUrl("/sta", host);
  const body = `ssid=${encodeURIComponent(ssid.trim())}&pass=${encodeURIComponent(pass)}`;

  if (Capacitor.isNativePlatform()) {
    const res = await withTimeout(
      Http.post({
        url,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: body,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      }),
      timeoutMs + 500,
    );
    if (res.status < 200 || res.status >= 300) throw new Error(`sta ${res.status}`);
    return;
  }

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: ctrl.signal,
      cache: "no-store",
      mode: "cors",
    });
    if (!res.ok) throw new Error(`sta ${res.status}`);
  } finally {
    window.clearTimeout(timer);
  }
}

export function buildStaticHostCandidates(preferred?: string, lastHost?: string): string[] {
  const ordered = [
    preferred,
    lastHost,
    ...FRAME_WIFI_STA_HOST_CANDIDATES,
  ].filter((h): h is string => Boolean(h));
  return [...new Set(ordered)];
}
