import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildYouTubeIframeSrc,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
} from "@/lib/youtube";

interface YouTubeNativePlayerProps {
  videoId: string;
  sourceUrl: string;
  title?: string;
  className?: string;
}

/**
 * No iOS/Android o WKWebView não envia Referer ao YouTube (erro 153).
 * Exibimos capa + play e abrimos o player no Safari in-app (SFSafariViewController).
 */
export function YouTubeNativePlayer({
  videoId,
  sourceUrl,
  title,
  className,
}: YouTubeNativePlayerProps) {
  const [opening, setOpening] = useState(false);
  const watchUrl = getYouTubeWatchUrl(sourceUrl) || sourceUrl;
  const thumbnailUrl = getYouTubeThumbnailUrl(videoId);

  const openPlayer = async () => {
    try {
      setOpening(true);
      const embedUrl = buildYouTubeIframeSrc(videoId);
      await Browser.open({
        url: embedUrl,
        presentationStyle: "fullscreen",
        toolbarColor: "#0f172a",
      });
    } catch {
      window.open(watchUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={openPlayer}
        disabled={opening}
        className="group relative aspect-video w-full overflow-hidden rounded-lg bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={title ? `Reproduzir: ${title}` : "Reproduzir vídeo"}
      >
        <img
          src={thumbnailUrl}
          alt=""
          className="h-full w-full object-cover opacity-90 transition group-hover:opacity-75"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/40">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition group-hover:scale-105">
            <Play className="ml-1 h-8 w-8 fill-white text-white" />
          </span>
        </div>
        {opening && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
            Abrindo player…
          </div>
        )}
      </button>
      <p className="text-xs text-muted-foreground">
        Toque para assistir no player do app. Para fechar, use &quot;Concluído&quot; no canto superior.
      </p>
    </div>
  );
}
