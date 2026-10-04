import type { LlmProvider } from "../providers/catalog";
import { anthropicClient, listAnthropicModels } from "./anthropic";
import { geminiClient, listGeminiModels } from "./gemini";
import { listOpenAiCompatModels, openAiCompatClient } from "./openai-compat";
import type { LlmClient, LlmConfig } from "./types";

export type { LlmClient, LlmConfig } from "./types";
export { generateJson } from "./json";

export function createLlm(cfg: LlmConfig): LlmClient {
  switch (cfg.provider) {
    case "anthropic":
      return anthropicClient(cfg);
    case "gemini":
      return geminiClient(cfg);
    default:
      return openAiCompatClient(cfg);
  }
}

/** Lists the models a key can use. Throws a ProviderError if the key is invalid. */
export async function listModels(provider: LlmProvider, key: string, baseUrl?: string | null): Promise<string[]> {
  const ids =
    provider === "anthropic" ? await listAnthropicModels(key)
    : provider === "gemini" ? await listGeminiModels(key)
    : await listOpenAiCompatModels(provider, key, baseUrl);
  return rankModels(provider, [...new Set(ids)]);
}

/**
 * Put the most capable general-purpose models first so the default pick is a
 * good one. Patterns are deliberately loose: providers ship new versions often.
 */
const PREFERENCE: Partial<Record<LlmProvider, RegExp[]>> = {
  anthropic: [/^claude-opus-5-5$/, /^claude-opus/, /^claude-sonnet/, /^claude-fable/],
  openai: [/^gpt-\d+(\.\d+)?$/, /^gpt-\d/, /^o\d/],
  gemini: [/pro(?!.*(preview|exp))/, /pro/, /flash(?!.*lite)/],
  openrouter: [/^anthropic\/claude-(opus|sonnet)/, /^openai\/gpt-\d/, /^google\/gemini.*pro/],
  groq: [/llama.*70b/, /qwen|kimi|gpt-oss-120b/],
  mistral: [/^mistral-large/, /^mistral-medium/],
  deepseek: [/^deepseek-chat$/, /^deepseek-reasoner$/],
};

export function rankModels(provider: LlmProvider, ids: string[]): string[] {
  const prefs = PREFERENCE[provider] ?? [];
  const score = (id: string) => {
    const i = prefs.findIndex((re) => re.test(id));
    return i < 0 ? prefs.length : i;
  };
  // Within a tier, newer-looking names (higher version numbers) first.
  return ids.sort((a, b) => score(a) - score(b) || b.localeCompare(a, undefined, { numeric: true }));
}
