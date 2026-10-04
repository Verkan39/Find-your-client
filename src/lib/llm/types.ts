import type { ZodType } from "zod";
import type { LlmProvider } from "../providers/catalog";

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  key: string;
  baseUrl?: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Sourced {
  text: string;
  sources: { title: string; url: string }[];
  searches: number;
}

/**
 * The minimum every AI provider implements, plus optional native capabilities.
 * Callers fall back to generic code paths when an optional method is missing or
 * the provider rejects it for the chosen model.
 */
export interface LlmClient {
  provider: LlmProvider;
  model: string;
  /** Plain completion. `json` asks for the provider's JSON mode where it has one. */
  complete(opts: { system: string; messages: ChatMessage[]; json?: boolean; maxTokens?: number }): Promise<{ text: string; truncated: boolean }>;
  /** Provider-enforced structured output (schema-constrained decoding). */
  structured?<T>(opts: { system: string; user: string; schema: ZodType<T>; name: string }): Promise<T>;
  /** Research with the provider's own web search tool. */
  research?(opts: { system: string; user: string }): Promise<Sourced>;
}
