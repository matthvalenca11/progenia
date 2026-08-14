const CORS_HEADERS_BASE = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const NATIVE_APP_ORIGIN_PREFIXES = ["capacitor://", "ionic://"];

const NATIVE_APP_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
]);

const DEFAULT_WEB_ORIGINS = new Set([
  "https://progenia.com.br",
  "https://www.progenia.com.br",
  "http://progenia.com.br",
  "http://www.progenia.com.br",
]);

const originHost = (origin: string) => {
  try {
    return new URL(origin).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const isAllowedOrigin = (origin: string) => {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (DEFAULT_WEB_ORIGINS.has(origin)) return true;
  if (NATIVE_APP_ORIGINS.has(origin)) return true;
  if (NATIVE_APP_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix))) return true;
  if (origin.startsWith("http://localhost:") || origin.startsWith("https://localhost:")) {
    return true;
  }

  const appUrl = Deno.env.get("APP_URL") ?? "";
  if (appUrl && (origin === appUrl || originHost(origin) === originHost(appUrl))) {
    return true;
  }

  const host = originHost(origin);
  return host === "progenia.com.br";
};

export const getCorsHeaders = (origin: string | null) => {
  const fallbackOrigin = Deno.env.get("APP_URL") ?? "*";
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : fallbackOrigin;

  return {
    ...CORS_HEADERS_BASE,
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
  };
};

const PRIVACY_HASH_SALT = Deno.env.get("PRIVACY_HASH_SALT") ?? "progenia-default-salt-change-me";

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function hashPersonalToken(value: string) {
  if (!value) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${PRIVACY_HASH_SALT}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

export function getClientIp(req: Request) {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  return ip || null;
}

export async function getClientPrivacyHashes(req: Request) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "";
  return {
    ipHash: ip ? await hashPersonalToken(ip) : null,
    userAgentHash: userAgent ? await hashPersonalToken(userAgent) : null,
  };
}

