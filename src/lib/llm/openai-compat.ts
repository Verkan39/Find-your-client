import { assertPublic } from "../crawler";
import type { LlmProvider } from "../providers/catalog";
import { ProviderError, requestJson } from "../providers/http";
import { extractJson, strictJsonSchema } from "./json";
import type { LlmClient, LlmConfig, Sourced } from "./types";

/**
 * OpenAI and every provider that speaks the OpenAI Chat Completions dialect.
 * Differences handled here:
 *  - OpenAI: `max_completion_tokens` (required by reasoning models), strict
 *    json_schema output, and the Responses API web_search tool for research.
 *  - Everyone else: `max_tokens`, json_object mode (retried without it if the
 *    model doesn't support it); schema validation happens in generateJson.
 */
export const BASE_URLS: Partial<Record<LlmProvider, string>> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
};

interface ChatResponse {
  choices?: { message?: { content?: string | { type: string; text?: string }[] | null }; finish_reason?: string }[];
}

const textOf = (c: string | { type: string; text?: string }[] | null | undefined) =>
  typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p.text ?? "").join("") : "";

export function baseUrlFor(cfg: Pick<LlmConfig, "provider" | "baseUrl">): string {
  const url = cfg.provider === "custom" ? cfg.baseUrl : BASE_URLS[cfg.provider];
  if (!url) throw new Error("This provider needs a base URL");
  return url.replace(/\/+$/, "");
}

export function headersFor(provider: LlmProvider, key: string): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (provider === "openrouter") {
    h["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    h["X-Title"] = "Find Your Client";
  }
  return h;
}

export function openAiCompatClient(cfg: LlmConfig): LlmClient {
  const base = baseUrlFor(cfg);
  const headers = headersFor(cfg.provider, cfg.key);
  const isOpenAI = cfg.provider === "openai";
  const tokenField = isOpenAI ? "max_completion_tokens" : "max_tokens";

  async function chat(body: Record<string, unknown>) {
    // Custom endpoints come from users: never let them point at our private network.
    if (cfg.provider === "custom") await assertPublic(new URL(base));
    return requestJson<ChatResponse>(cfg.provider, `${base}/chat/completions`, {
      method: "POST", headers, body: JSON.stringify({ model: cfg.model, ...body }), timeoutMs: 300_000,
    });
  }

  const client: LlmClient = {
    provider: cfg.provider,
    model: cfg.model,

    async complete({ system, messages, json, maxTokens = 16000 }) {
      const body: Record<string, unknown> = {
        messages: [{ role: "system", content: system }, ...messages],
        [tokenField]: isOpenAI ? Math.max(maxTokens, 32000) : maxTokens,
      };
      let res: ChatResponse;
      try {
        res = await chat(json ? { ...body, response_format: { type: "json_object" } } : body);
      } catch (e) {
        // Some models don't support JSON mode; the prompt still asks for JSON.
        if (json && e instanceof ProviderError && e.status === 400) res = await chat(body);
        else throw e;
      }
      const choice = res.choices?.[0];
      return { text: textOf(choice?.message?.content), truncated: choice?.finish_reason === "length" };
    },
  };

  if (isOpenAI) {
    client.structured = async ({ system, user, schema, name }) => {
      const res = await chat({
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        [tokenField]: 32000,
        response_format: { type: "json_schema", json_schema: { name, strict: true, schema: strictJsonSchema(schema) } },
      });
      const parsed = schema.safeParse(extractJson(textOf(res.choices?.[0]?.message?.content)));
      if (!parsed.success) throw new ProviderError("openai", 422, "structured output didn't validate");
      return parsed.data;
    };

    client.research = async ({ system, user }): Promise<Sourced> => {
      interface ResponsesOutput {
        output?: {
          type: string;
          content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
        }[];
      }
      const res = await requestJson<ResponsesOutput>("openai", `${base}/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: cfg.model, instructions: system, input: user, tools: [{ type: "web_search" }], max_output_tokens: 32000 }),
        timeoutMs: 300_000,
      });
      const sources = new Map<string, string>();
      let text = "";
      let searches = 0;
      for (const item of res.output ?? []) {
        if (item.type === "web_search_call") searches++;
        if (item.type !== "message") continue;
        for (const part of item.content ?? []) {
          if (part.type === "output_text" && part.text) text += part.text;
          for (const a of part.annotations ?? []) if (a.type === "url_citation" && a.url) sources.set(a.url, a.title ?? a.url);
        }
      }
      if (!text) throw new ProviderError("openai", 422, "web search returned no text");
      return { text, sources: [...sources].map(([url, title]) => ({ url, title })), searches };
    };
  }

  return client;
}

/** Model ids available to this key (also validates the key). */
export async function listOpenAiCompatModels(provider: LlmProvider, key: string, baseUrl?: string | null): Promise<string[]> {
  const base = baseUrlFor({ provider, baseUrl });
  if (provider === "custom") await assertPublic(new URL(base));
  const headers = headersFor(provider, key);

  if (provider === "openrouter") {
    // The model list is public on OpenRouter, so check the key explicitly first.
    await requestJson("openrouter", `${base}/key`, { headers, timeoutMs: 20_000 });
  }
  try {
    const res = await requestJson<{ data?: { id: string }[] }>(provider, `${base}/models`, { headers, timeoutMs: 20_000 });
    const ids = (res.data ?? []).map((m) => m.id);
    const skip = /(embed|whisper|tts|audio|realtime|transcribe|image|dall-e|moderation|guard|ocr|search-preview|babbage|davinci)/i;
    return ids.filter((id) => !skip.test(id) && (provider !== "openai" || /^(gpt-|o\d|chatgpt-)/.test(id)));
  } catch (e) {
    // Some custom servers don't implement /models; the key may still be fine.
    if (provider === "custom" && e instanceof ProviderError && e.status === 404) return [];
    throw e;
  }
}
