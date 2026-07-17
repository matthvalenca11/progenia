export type CompletionSuggestionCount = 3 | 6 | 9;

export type CompletionSuggestionType = "capsule" | "lesson" | "youtube" | "paper";

export interface CompletionSuggestionItem {
  id: string;
  type: CompletionSuggestionType;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  /** URL externa (YouTube, paper). */
  url?: string;
  /** ID interno (cápsula ou aula). */
  resourceId?: string;
}

export interface CompletionSuggestionsConfig {
  enabled: boolean;
  count: CompletionSuggestionCount;
  items: CompletionSuggestionItem[];
}

export const DEFAULT_COMPLETION_SUGGESTIONS: CompletionSuggestionsConfig = {
  enabled: false,
  count: 3,
  items: [],
};
