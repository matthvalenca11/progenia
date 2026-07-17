import { ExternalLink, FileText, Play, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getMosaicGridClass,
  getMosaicTileLayouts,
  getSuggestionTypeLabel,
  isExternalSuggestion,
  resolveSuggestionHref,
  resolveSuggestionThumbnail,
} from "@/lib/completionSuggestions";
import type { CompletionSuggestionItem } from "@/types/completionSuggestions";

interface CompletionSuggestionsMosaicProps {
  title?: string;
  subtitle?: string;
  items: CompletionSuggestionItem[];
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

function TypeIcon({ type }: { type: CompletionSuggestionItem["type"] }) {
  if (type === "youtube") return <Play className="h-3.5 w-3.5" />;
  if (type === "paper") return <FileText className="h-3.5 w-3.5" />;
  return <Sparkles className="h-3.5 w-3.5" />;
}

export function CompletionSuggestionsMosaic({
  title = "Continue explorando",
  subtitle = "Sugestões selecionadas para aprofundar este tema.",
  items,
  onDismiss,
  dismissLabel = "Voltar ao dashboard",
  className,
}: CompletionSuggestionsMosaicProps) {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  const count = items.length <= 3 ? 3 : items.length <= 6 ? 6 : 9;
  const layouts = getMosaicTileLayouts(count);
  const gridClass = getMosaicGridClass(count);

  const handleClick = (item: CompletionSuggestionItem) => {
    const href = resolveSuggestionHref(item);
    if (!href) return;

    if (isExternalSuggestion(item)) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    navigate(href);
  };

  return (
    <Card className={cn("overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 to-background", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={gridClass}>
          {items.map((item, index) => {
            const href = resolveSuggestionHref(item);
            const thumbnail = resolveSuggestionThumbnail(item);
            const disabled = !href;

            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => handleClick(item)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all",
                  "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  disabled && "cursor-not-allowed opacity-60",
                  layouts[index]?.className,
                )}
              >
                <div className="absolute inset-0">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-muted via-muted/70 to-accent/20" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
                </div>

                <div className="relative flex h-full min-h-[inherit] flex-col justify-end p-3 sm:p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1 bg-black/45 text-white backdrop-blur-sm">
                      <TypeIcon type={item.type} />
                      {getSuggestionTypeLabel(item.type)}
                    </Badge>
                    {isExternalSuggestion(item) && (
                      <ExternalLink className="h-3.5 w-3.5 text-white/80" />
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-white sm:text-base">
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="mt-1 line-clamp-2 text-xs text-white/80 sm:text-sm">
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {onDismiss && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={onDismiss}>
              {dismissLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
