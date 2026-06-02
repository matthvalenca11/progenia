/**
 * Native-only session vault (Capacitor Preferences).
 *
 * Web uses Supabase's default localStorage. On iOS/Android the WebView wipes
 * localStorage on process kill, so we keep access + refresh tokens here and
 * restore them on every cold start via supabase.auth.setSession().
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";

const KEY = "progenia_native_session";

export type StoredNativeSession = {
  access_token: string;
  refresh_token: string;
};

export const isNative =
  Capacitor.isNativePlatform() &&
  (Capacitor.getPlatform() === "ios" || Capacitor.getPlatform() === "android");

export async function readNativeSession(): Promise<StoredNativeSession | null> {
  if (!isNative) return null;
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return null;
    const parsed = JSON.parse(value) as StoredNativeSession;
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveNativeSession(session: StoredNativeSession): Promise<void> {
  if (!isNative) return;
  await Preferences.set({ key: KEY, value: JSON.stringify(session) });
}

export async function clearNativeSession(): Promise<void> {
  if (!isNative) return;
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    // ignore
  }
}

function isInvalidRefreshError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("invalid refresh token") ||
    m.includes("refresh token not found") ||
    m.includes("invalid jwt") ||
    m.includes("token is expired") ||
    m.includes("session not found")
  );
}

/**
 * Restores session from Preferences into the Supabase client.
 * Returns the active session or null. Only clears vault on definitively invalid tokens.
 */
export async function restoreNativeSessionIntoSupabase() {
  const stored = await readNativeSession();
  if (!stored) return { session: null as null, restored: false };

  const { data, error } = await supabase.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  });

  if (error) {
    if (isInvalidRefreshError(error.message)) {
      await clearNativeSession();
    }
    console.warn("[nativeSession] restore failed:", error.message);
    return { session: null, restored: false };
  }

  if (!data.session) {
    return { session: null, restored: false };
  }

  await saveNativeSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  return { session: data.session, restored: true };
}
