import { ProviderError, requestJson } from "../providers/http";
import type { ChatMessage, LlmClient, LlmConfig, Sourced } from "./types";

/**
 * Google Gemini via the Generative Language REST API. JSON comes from
 * `responseMimeType: application/json` (validated in generateJson), and research
 * is grounded with the built-in Google Search tool.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GenerateResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
  promptFeedback?: { blockReason?: string };
}

const toContents = (messages: ChatMessage[]) =>
  messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

export function geminiClient(cfg: LlmConfig): LlmClient {
  const model = cfg.model.replace(/^models\//, "");
  const headers = { "x-goog-api-key": cfg.key, "Content-Type": "application/json" };

  async function generate(body: Record<string, unknown>) {
    const res = await requestJson<GenerateResponse>("gemini", `${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers, body: JSON.stringify(body), timeoutMs: 300_000,
    });
    if (res.promptFeedback?.blockReason) throw new ProviderError("gemini", 400, `blocked: ${res.promptFeedback.blockReason}`);
    const cand = res.candidates?.[0];
    if (cand?.finishReason === "SAFETY" || cand?.finishReason === "RECITATION") throw new ProviderError("gemini", 400, `stopped: ${cand.finishReason}`);
    // Skip thought summaries if the model returns them.
    const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
    return { text, cand };
  }

  return {
    provider: "gemini",
    model,

    async complete({ system, messages, json, maxTokens = 16000 }) {
      const { text, cand } = await generate({
        systemInstruction: { parts: [{ text: system }] },
        contents: toContents(messages),
        generationConfig: { maxOutputTokens: Math.max(maxTokens, 32768), ...(json ? { responseMimeType: "application/json" } : {}) },
      });
      return { text, truncated: cand?.finishReason === "MAX_TOKENS" };
    },

    async research({ system, user }): Promise<Sourced> {
      const { text, cand } = await generate({
        systemInstruction: { parts: [{ text: system }] },
        contents: toContents([{ role: "user", content: user }]),
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 32768 },
      });
      const g = cand?.groundingMetadata;
      const sources = (g?.groundingChunks ?? [])
        .map((c) => c.web)
        .filter((w): w is { uri: string; title?: string } => Boolean(w?.uri))
        .map((w) => ({ url: w.uri, title: w.title ?? w.uri }));
      return { text, sources, searches: g?.webSearchQueries?.length ?? 0 };
    },
  };
}

export async function listGeminiModels(key: string): Promise<string[]> {
  const res = await requestJson<{ models?: { name: string; supportedGenerationMethods?: string[] }[] }>(
    "gemini", `${BASE}/models?pageSize=1000`, { headers: { "x-goog-api-key": key }, timeoutMs: 20_000 },
  );
  return (res.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((id) => /^gemini/.test(id) && !/(embedding|aqa|tts|image|live|audio)/i.test(id));
}
