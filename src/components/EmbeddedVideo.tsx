import { useState } from "react";
import { cn } from "@/lib/utils";
import { isNativeMobile } from "@/lib/capacitor";
import { YouTubeNativePlayer } from "@/components/YouTubeNativePlayer";
import {
  buildYouTubeIframeSrc,
  getYouTubeVideoId,
  isYouTubeUrl,
} from "@/lib/youtube";

function getVimeoEmbedUrl(url: string): string | null {
  if (!url?.includes("vimeo.com")) return null;
  const id = url.split("vimeo.com/")[1]?.split("?")[0]?.split("/")[0];
  return id ? `https://player.vimeo.com/video/${id}` : null;
}

interface EmbeddedVideoProps {
  url: string;
  title?: string;
  className?: string;
}

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

/** Reproduz vídeo: web usa iframe; app nativo usa player in-app (Safari View). */
export function EmbeddedVideo({ url, title, className }: EmbeddedVideoProps) {
  const [videoError, setVideoError] = useState(false);

  if (!url?.trim()) return null;

  if (isYouTubeUrl(url)) {
    const videoId = getYouTubeVideoId(url);

    if (!videoId) {
      return (
        <p className="text-sm text-muted-foreground">Link do YouTube inválido.</p>
      );
    }

    if (isNativeMobile) {
      return (
        <YouTubeNativePlayer
          videoId={videoId}
          sourceUrl={url}
          title={title}
          className={className}
        />
      );
    }

    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-muted", className)}>
        <iframe
          src={buildYouTubeIframeSrc(videoId)}
          title={title || "Vídeo"}
          className="h-full w-full"
          allowFullScreen
          allow={IFRAME_ALLOW}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  const vimeoEmbed = getVimeoEmbedUrl(url);
  if (vimeoEmbed) {
    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-muted", className)}>
        <iframe
          src={vimeoEmbed}
          title={title || "Vídeo"}
          className="h-full w-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-muted", className)}>
      {!videoError ? (
        <video
          src={url}
          controls
          className="h-full w-full"
          preload="metadata"
          playsInline
          onError={() => setVideoError(true)}
        >
          Seu navegador não suporta reprodução de vídeo.
        </video>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          Erro ao carregar vídeo
        </div>
      )}
    </div>
  );
}
