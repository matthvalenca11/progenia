/** Helpers para links e embed do YouTube (vídeos hospedados fora do ProGenia). */

/** Referer exigido pelo YouTube em apps iOS/Android (Bundle ID / Application ID). */
export const YOUTUBE_APP_REFERER = "https://com.matthvalenca11.progenia";

export const YOUTUBE_URL_PLACEHOLDER = "https://www.youtube.com/watch?v=...";
export const YOUTUBE_URL_HINT =
  "Cole o link do YouTube. O vídeo será exibido aqui no ProGenia, sem abrir o site do YouTube.";

export function isYouTubeUrl(url: string): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  try {
    const host = new URL(trimmed).hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com";
  } catch {
    return trimmed.includes("youtube.com") || trimmed.includes("youtu.be");
  }
}

export function getYouTubeVideoId(url: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      return id || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] || null;
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] || null;
      }
      const v = parsed.searchParams.get("v");
      return v || null;
    }
  } catch {
    // fall through to regex
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

/** URL de watch para fallback (abrir no app do YouTube / Safari). */
export function getYouTubeWatchUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

/** Parâmetros do player embed (web e Safari in-app). */
export function buildYouTubeIframeSrc(
  videoId: string,
  origin?: string,
): string {
  const resolvedOrigin =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    YOUTUBE_APP_REFERER;

  const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  embed.searchParams.set("rel", "0");
  embed.searchParams.set("playsinline", "1");
  embed.searchParams.set("modestbranding", "1");
  embed.searchParams.set("enablejsapi", "1");
  embed.searchParams.set("origin", resolvedOrigin);
  embed.searchParams.set("widget_referrer", resolvedOrigin);
  return embed.toString();
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  return buildYouTubeIframeSrc(videoId);
}

/** Thumbnail padrão do YouTube para capa do player nativo. */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Relay HTTPS (site publicado). Só funciona inline no iOS se o arquivo estiver no deploy.
 * @see public/youtube-player.html
 */
export function getYouTubeRelaySrc(videoId: string): string {
  const base = (
    (import.meta.env.VITE_YOUTUBE_WRAPPER_ORIGIN as string | undefined) ||
    (import.meta.env.VITE_APP_URL as string | undefined) ||
    ""
  ).replace(/\/$/, "");
  if (!base) return "";
  const page = new URL("/youtube-player.html", base);
  page.searchParams.set("v", videoId);
  return page.toString();
}

export function validateYouTubeUrl(url: string): boolean {
  return isYouTubeUrl(url) && !!getYouTubeVideoId(url);
}

export function assertValidYouTubeUrl(url: string, label = "vídeo"): void {
  if (!url?.trim()) {
    throw new Error(`Informe o link do YouTube para o ${label}.`);
  }
  if (!validateYouTubeUrl(url)) {
    throw new Error(
      `Link do YouTube inválido para o ${label}. Use um link como ${YOUTUBE_URL_PLACEHOLDER}`,
    );
  }
}
