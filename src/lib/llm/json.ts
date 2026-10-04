import { z, type ZodType } from "zod";
import { ProviderError } from "../providers/http";
import type { ChatMessage, LlmClient } from "./types";

/** JSON Schema for a zod schema, minus the meta keys providers choke on. */
export function jsonSchemaOf(schema: ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

/** Strict-mode variant: every object closed and every property required. */
export function strictJsonSchema(schema: ZodType): Record<string, unknown> {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = visit(v);
    if (out.type === "object" && out.properties) {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties as object);
    }
    return out;
  };
  return visit(jsonSchemaOf(schema)) as Record<string, unknown>;
}

/** Models sometimes wrap JSON in prose or code fences; take the outermost object. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in the response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const issuesOf = (err: z.ZodError) =>
  err.issues.slice(0, 15).map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");

/**
 * Get schema-valid JSON from any provider:
 *  1. provider-native structured output when available;
 *  2. otherwise JSON mode + the schema in the prompt, validated with zod,
 *     with one repair round that feeds the validation errors back.
 */
export async function generateJson<T>(llm: LlmClient, opts: { system: string; user: string; schema: ZodType<T>; name: string }): Promise<T> {
  if (llm.structured) {
    try {
      return await llm.structured(opts);
    } catch (e) {
      // Auth/quota problems won't be fixed by a different code path.
      if (e instanceof ProviderError && e.status !== 400 && e.status !== 422) throw e;
    }
  }

  const system = `${opts.system}

Respond with ONLY a JSON object (no prose, no code fences) that validates against this JSON Schema:
${JSON.stringify(jsonSchemaOf(opts.schema))}`;
  const messages: ChatMessage[] = [{ role: "user", content: opts.user }];

  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, truncated } = await llm.complete({ system, messages, json: true, maxTokens: 16000 });
    let problem: string;
    try {
      const parsed = opts.schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      problem = `It failed validation:\n${issuesOf(parsed.error)}`;
    } catch (e) {
      problem = truncated ? "It was cut off before the end. Keep every text field shorter." : `It wasn't valid JSON (${e instanceof Error ? e.message : e}).`;
    }
    messages.push({ role: "assistant", content: text.slice(0, 20000) }, {
      role: "user",
      content: `Your previous answer can't be used. ${problem}\nReturn the complete corrected JSON object only.`,
    });
  }
  throw new Error(`${llm.provider} couldn't produce a valid ${opts.name} after a repair attempt`);
}
