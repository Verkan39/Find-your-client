import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ProviderError } from "../providers/http";
import type { LlmClient, LlmConfig, Sourced } from "./types";

/**
 * Claude via the official SDK. Request options depend on the model the user picked:
 * 4.6+ / 5.x families get adaptive thinking, effort, the 2026 web tools and
 * server-side structured output; older models get the conservative equivalents
 * (and structured output falls back to the generic JSON path).
 */
const MODERN = /^claude-(opus|sonnet)-(4-[6-9]|[5-9])|^claude-(fable|mythos)-/;
/** Models where the server-side refusal fallback ("default" mode) is supported. */
const FALLBACK_MODELS = new Set(["claude-opus-5", "claude-opus-5-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

function wrap(e: unknown): never {
  if (e instanceof Anthropic.APIError) throw new ProviderError("anthropic", e.status ?? 0, e.message);
  throw e;
}

function checkStop(msg: { stop_reason: string | null; stop_details?: { category?: string | null } | null }) {
  if (msg.stop_reason === "refusal") throw new Error(`Claude declined this request (${msg.stop_details?.category ?? "policy"})`);
}

export function anthropicClient(cfg: LlmConfig): LlmClient {
  const client = new Anthropic({ apiKey: cfg.key, maxRetries: 3 });
  const modern = MODERN.test(cfg.model);
  const fallback = FALLBACK_MODELS.has(cfg.model);
  const base = {
    model: cfg.model,
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01" as const], fallbacks: "default" as const } : {}),
    ...(modern ? { thinking: { type: "adaptive" as const } } : {}),
  };

  return {
    provider: "anthropic",
    model: cfg.model,

    async complete({ system, messages, maxTokens = 16000 }) {
      try {
        const msg = await client.beta.messages
          .stream({
            ...base,
            max_tokens: modern ? Math.max(maxTokens, 32000) : maxTokens,
            ...(modern ? { output_config: { effort: "high" as const } } : {}),
            system,
            messages,
          })
          .finalMessage();
        checkStop(msg);
        const text = msg.content.filter((c) => c.type === "text").map((c) => (c as Anthropic.Beta.BetaTextBlock).text).join("\n");
        return { text, truncated: msg.stop_reason === "max_tokens" };
      } catch (e) {
        return wrap(e);
      }
    },

    // Server-enforced schema only on current-generation models.
    ...(modern
      ? {
          async structured({ system, user, schema }) {
            try {
              const msg = await client.beta.messages
                .stream({
                  ...base,
                  max_tokens: 64000,
                  output_config: { effort: "high", format: betaZodOutputFormat(schema) },
                  system,
                  messages: [{ role: "user", content: user }],
                })
                .finalMessage();
              checkStop(msg);
              if (msg.stop_reason === "max_tokens") throw new Error("Claude hit the output limit");
              if (!msg.parsed_output) throw new ProviderError("anthropic", 422, "output didn't match the schema");
              return msg.parsed_output;
            } catch (e) {
              return wrap(e);
            }
          },
        } satisfies Pick<LlmClient, "structured">
      : {}),

    async research({ system, user }): Promise<Sourced> {
      const tools: Anthropic.Beta.BetaToolUnion[] = modern
        ? [
            { type: "web_search_20260209", name: "web_search", max_uses: 10 },
            { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8, max_content_tokens: 12000 },
          ]
        : [{ type: "web_search_20250305", name: "web_search", max_uses: 10 }];
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
      const sources = new Map<string, string>();
      let searches = 0;
      let text = "";
      try {
        for (let turn = 0; turn < 5; turn++) {
          const msg = await client.beta.messages
            .stream({
              ...base,
              max_tokens: modern ? 64000 : 16000,
              ...(modern ? { output_config: { effort: "high" as const } } : {}),
              system,
              tools,
              messages,
            })
            .finalMessage();
          checkStop(msg);
          for (const block of msg.content) {
            if (block.type === "server_tool_use") searches++;
            if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
              for (const r of block.content) if (r.type === "web_search_result") sources.set(r.url, r.title);
            }
            if (block.type === "text" && block.citations) {
              for (const c of block.citations) if (c.type === "web_search_result_location") sources.set(c.url, c.title ?? c.url);
            }
          }
          text = msg.content.filter((c) => c.type === "text").map((c) => (c as Anthropic.Beta.BetaTextBlock).text).join("\n").trim() || text;
          if (msg.stop_reason !== "pause_turn") break;
          // The server-side tool loop paused; send the turn back and it resumes.
          messages.push({ role: "assistant", content: msg.content });
        }
      } catch (e) {
        return wrap(e);
      }
      return { text, sources: [...sources].map(([url, title]) => ({ url, title })), searches };
    },
  };
}

export async function listAnthropicModels(key: string): Promise<string[]> {
  try {
    const client = new Anthropic({ apiKey: key, maxRetries: 1 });
    const ids: string[] = [];
    for await (const m of client.models.list({ limit: 100 })) ids.push(m.id);
    return ids;
  } catch (e) {
    return wrap(e);
  }
}
