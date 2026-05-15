const CORS_HEADERS_BASE = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

export const getCorsHeaders = (origin: string | null) => {
  const fallbackOrigin = Deno.env.get("APP_URL") ?? "*";
  let allowOrigin = fallbackOrigin;

  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:"))) {
    allowOrigin = origin;
  }

  return {
    ...CORS_HEADERS_BASE,
    "Access-Control-Allow-Origin": allowOrigin,
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

