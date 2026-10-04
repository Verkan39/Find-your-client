/**
 * Every third-party provider a user can plug in, with what the UI needs to explain
 * it. Client-safe: contains no secrets and no server code.
 */

export type LlmProvider = "anthropic" | "openai" | "gemini" | "openrouter" | "groq" | "mistral" | "deepseek" | "custom";
export type PlacesProvider = "google_places" | "yelp";
export type SearchProvider = "tavily" | "brave" | "serper";
export type ProviderId = LlmProvider | PlacesProvider | SearchProvider;
export type SearchChoice = "native" | SearchProvider;

export interface ProviderInfo {
  id: ProviderId;
  kind: "llm" | "places" | "search";
  name: string;
  tagline: string;
  /** Where to create a key. */
  keyUrl: string;
  /** Shown as the input placeholder. */
  keyPlaceholder: string;
  /** LLM only: can it search the web by itself during research? */
  nativeSearch?: boolean;
  /** Needs a base URL (OpenAI-compatible endpoints). */
  needsBaseUrl?: boolean;
  notes?: string;
  recommended?: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  /* ------------------------------- AI models ------------------------------- */
  anthropic: {
    id: "anthropic", kind: "llm", name: "Anthropic Claude", recommended: true, nativeSearch: true,
    tagline: "Best results: researches the web itself and writes structured briefs.",
    keyUrl: "https://console.anthropic.com/settings/keys", keyPlaceholder: "sk-ant-…",
    notes: "Built-in web search and fetch. Deep research needs no extra key.",
  },
  openai: {
    id: "openai", kind: "llm", name: "OpenAI", nativeSearch: true,
    tagline: "GPT models with strict JSON output and built-in web search.",
    keyUrl: "https://platform.openai.com/api-keys", keyPlaceholder: "sk-…",
    notes: "Uses OpenAI's web search tool for research; falls back to your search key if your model doesn't support it.",
  },
  gemini: {
    id: "gemini", kind: "llm", name: "Google Gemini", nativeSearch: true,
    tagline: "Gemini models grounded with Google Search. Generous free tier.",
    keyUrl: "https://aistudio.google.com/app/apikey", keyPlaceholder: "AIza…",
    notes: "Research is grounded with Google Search. No extra key needed.",
  },
  openrouter: {
    id: "openrouter", kind: "llm", name: "OpenRouter",
    tagline: "One key for hundreds of models from every major lab.",
    keyUrl: "https://openrouter.ai/settings/keys", keyPlaceholder: "sk-or-…",
    notes: "Add a web search key (Tavily, Brave or Serper) to enable deep research.",
  },
  groq: {
    id: "groq", kind: "llm", name: "Groq",
    tagline: "Open models (Llama, Qwen…) at very high speed and low cost.",
    keyUrl: "https://console.groq.com/keys", keyPlaceholder: "gsk_…",
    notes: "Add a web search key to enable deep research.",
  },
  mistral: {
    id: "mistral", kind: "llm", name: "Mistral",
    tagline: "European models with JSON mode. EU data residency.",
    keyUrl: "https://console.mistral.ai/api-keys", keyPlaceholder: "Your Mistral key",
    notes: "Add a web search key to enable deep research.",
  },
  deepseek: {
    id: "deepseek", kind: "llm", name: "DeepSeek",
    tagline: "Very low-cost chat and reasoning models.",
    keyUrl: "https://platform.deepseek.com/api_keys", keyPlaceholder: "sk-…",
    notes: "Add a web search key to enable deep research.",
  },
  custom: {
    id: "custom", kind: "llm", name: "OpenAI-compatible", needsBaseUrl: true,
    tagline: "Together, Fireworks, a self-hosted vLLM… any /v1/chat/completions API.",
    keyUrl: "https://platform.openai.com/docs/api-reference/chat", keyPlaceholder: "API key for your endpoint",
    notes: "Must be a public HTTPS URL ending in /v1. Add a web search key for deep research.",
  },

  /* ------------------------------ business data ----------------------------- */
  google_places: {
    id: "google_places", kind: "places", name: "Google Places", recommended: true,
    tagline: "Ratings, review counts, price level, hours and review text, worldwide.",
    keyUrl: "https://console.cloud.google.com/apis/library/places.googleapis.com", keyPlaceholder: "AIza…",
    notes: "Enable \"Places API (New)\" in your Google Cloud project and restrict the key to it.",
  },
  yelp: {
    id: "yelp", kind: "places", name: "Yelp Fusion",
    tagline: "Ratings, review counts, price and review excerpts.",
    keyUrl: "https://www.yelp.com/developers/v3/manage_app", keyPlaceholder: "Your Yelp API key",
    notes: "Best coverage in the US, Canada, UK, Australia and parts of Europe.",
  },

  /* -------------------------------- web search ------------------------------- */
  tavily: {
    id: "tavily", kind: "search", name: "Tavily", recommended: true,
    tagline: "Search built for AI agents, with clean page extracts. Free monthly credits.",
    keyUrl: "https://app.tavily.com/home", keyPlaceholder: "tvly-…",
  },
  brave: {
    id: "brave", kind: "search", name: "Brave Search",
    tagline: "Independent web index with a free tier.",
    keyUrl: "https://api-dashboard.search.brave.com/app/keys", keyPlaceholder: "BSA…",
  },
  serper: {
    id: "serper", kind: "search", name: "Serper",
    tagline: "Google search results via API. Cheap per query.",
    keyUrl: "https://serper.dev/api-key", keyPlaceholder: "Your Serper key",
  },
};

export const LLM_PROVIDERS = Object.values(PROVIDERS).filter((p) => p.kind === "llm");
export const PLACES_PROVIDERS = Object.values(PROVIDERS).filter((p) => p.kind === "places");
export const SEARCH_PROVIDERS = Object.values(PROVIDERS).filter((p) => p.kind === "search");

export const isProviderId = (v: string): v is ProviderId => v in PROVIDERS;

/** Shape returned to the profile page: hints only, never keys. */
export interface IntegrationsView {
  keys: Partial<Record<ProviderId, { hint: string; baseUrl: string | null; verifiedAt: string | null }>>;
  settings: {
    llmProvider: LlmProvider | null;
    llmModel: string | null;
    placesProvider: PlacesProvider | null;
    searchProvider: SearchChoice | null;
  };
}

/** What the rest of the app may know about a user's setup (no secrets). */
export interface CapabilityStatus {
  ai: { provider: LlmProvider; providerName: string; model: string } | null;
  places: { provider: PlacesProvider; providerName: string } | null;
  research: { via: "native" | SearchProvider; name: string } | null;
}
