import {
  CompletionSuggestionCount,
  CompletionSuggestionItem,
  CompletionSuggestionsConfig,
  DEFAULT_COMPLETION_SUGGESTIONS,
} from "@/types/completionSuggestions";
import { getYouTubeThumbnailUrl, getYouTubeVideoId } from "@/lib/youtube";

export function normalizeCompletionSuggestions(
  raw: unknown,
): CompletionSuggestionsConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_COMPLETION_SUGGESTIONS };
  }

  const data = raw as Partial<CompletionSuggestionsConfig>;
  const count: CompletionSuggestionCount =
    data.count === 6 || data.count === 9 ? data.count : 3;

  const items = Array.isArray(data.items)
    ? data.items
        .filter((item): item is CompletionSuggestionItem => !!item && typeof item === "object")
        .map((item, index) => ({
          id: typeof item.id === "string" ? item.id : `suggestion-${index}`,
          type:
            item.type === "lesson" ||
            item.type === "youtube" ||
            item.type === "paper"
              ? item.type
              : "capsule",
          title: typeof item.title === "string" ? item.title : "",
          subtitle: typeof item.subtitle === "string" ? item.subtitle : undefined,
          thumbnailUrl:
            typeof item.thumbnailUrl === "string" ? item.thumbnailUrl : undefined,
          url: typeof item.url === "string" ? item.url : undefined,
          resourceId:
            typeof item.resourceId === "string" ? item.resourceId : undefined,
        }))
        .slice(0, count)
    : [];

  return {
    enabled: !!data.enabled,
    count,
    items,
  };
}

export function getActiveCompletionSuggestions(
  raw: unknown,
): CompletionSuggestionItem[] {
  const config = normalizeCompletionSuggestions(raw);
  if (!config.enabled) return [];
  return config.items.filter((item) => item.title.trim()).slice(0, config.count);
}

export function resolveSuggestionHref(item: CompletionSuggestionItem): string | null {
  switch (item.type) {
    case "capsule":
      return item.resourceId ? `/capsula/${item.resourceId}` : null;
    case "lesson":
      return item.resourceId ? `/lesson/${item.resourceId}` : null;
    case "youtube":
    case "paper":
      return item.url?.trim() || null;
    default:
      return null;
  }
}

export function resolveSuggestionThumbnail(item: CompletionSuggestionItem): string | null {
  if (item.thumbnailUrl?.trim()) return item.thumbnailUrl.trim();

  if (item.type === "youtube" && item.url) {
    const videoId = getYouTubeVideoId(item.url);
    if (videoId) return getYouTubeThumbnailUrl(videoId);
  }

  return null;
}

export function isExternalSuggestion(item: CompletionSuggestionItem): boolean {
  return item.type === "youtube" || item.type === "paper";
}

export type MosaicTileLayout = {
  className: string;
};

/** Layout tipo end screen do YouTube: destaque no primeiro item quando há 3 sugestões. */
export function getMosaicTileLayouts(count: CompletionSuggestionCount): MosaicTileLayout[] {
  if (count === 3) {
    return [
      { className: "md:col-span-2 md:row-span-2 min-h-[180px] md:min-h-[280px]" },
      { className: "md:col-span-1 min-h-[140px]" },
      { className: "md:col-span-1 min-h-[140px]" },
    ];
  }

  if (count === 6) {
    return Array.from({ length: 6 }, () => ({
      className: "min-h-[140px] md:min-h-[160px]",
    }));
  }

  return Array.from({ length: 9 }, () => ({
    className: "min-h-[120px] md:min-h-[140px]",
  }));
}

export function getMosaicGridClass(count: CompletionSuggestionCount): string {
  if (count === 3) {
    return "grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-3";
  }
  if (count === 6) {
    return "grid grid-cols-2 md:grid-cols-3 gap-3";
  }
  return "grid grid-cols-2 md:grid-cols-3 gap-3";
}

export function getSuggestionTypeLabel(type: CompletionSuggestionItem["type"]): string {
  switch (type) {
    case "capsule":
      return "Cápsula";
    case "lesson":
      return "Aula";
    case "youtube":
      return "YouTube";
    case "paper":
      return "Artigo";
    default:
      return "Conteúdo";
  }
}
