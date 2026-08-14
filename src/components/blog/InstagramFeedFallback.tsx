import { Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INSTAGRAM_EMBED_URL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_PROFILE_URL,
} from "@/lib/instagramProfile";

type Props = {
  compact?: boolean;
};

export function InstagramFeedFallback({ compact = false }: Props) {
  return (
    <div className={compact ? "space-y-3" : "mx-auto max-w-xl space-y-4"}>
      <div className="rounded-xl border border-border bg-card p-5 text-center">
        <Instagram className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="font-medium text-foreground">
          O feed automático está indisponível no momento
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          As novidades continuam no Instagram @{INSTAGRAM_HANDLE}.
        </p>
        <Button asChild className="mt-4">
          <a href={INSTAGRAM_PROFILE_URL} target="_blank" rel="noopener noreferrer">
            Abrir Instagram
          </a>
        </Button>
      </div>
      <iframe
        title={`Instagram @${INSTAGRAM_HANDLE}`}
        src={INSTAGRAM_EMBED_URL}
        className={`w-full rounded-xl border border-border bg-background ${compact ? "min-h-[420px]" : "min-h-[640px]"}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
