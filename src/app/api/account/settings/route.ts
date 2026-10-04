import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, unlocked } from "@/lib/api";
import { getIntegrations, updateSettings } from "@/lib/keys";

export const dynamic = "force-dynamic";

const Body = z.object({
  llmProvider: z.enum(["anthropic", "openai", "gemini", "openrouter", "groq", "mistral", "deepseek", "custom"]).nullable().optional(),
  llmModel: z.string().trim().min(1).max(200).nullable().optional(),
  placesProvider: z.enum(["google_places", "yelp"]).nullable().optional(),
  searchProvider: z.enum(["native", "tavily", "brave", "serper"]).nullable().optional(),
});

/** Choose which saved provider/model to use. Only providers with a saved key are allowed. */
export async function PATCH(req: Request) {
  const { user, denied } = await unlocked();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid settings");
  const b = parsed.data;
  const { keys } = await getIntegrations(user.id);
  for (const p of [b.llmProvider, b.placesProvider, b.searchProvider === "native" ? null : b.searchProvider]) {
    if (p && !keys[p]) return badRequest("Save a key for that provider first.");
  }

  const patch: Parameters<typeof updateSettings>[1] = {};
  if (b.llmProvider !== undefined) patch.llm_provider = b.llmProvider;
  if (b.llmModel !== undefined) patch.llm_model = b.llmModel;
  if (b.placesProvider !== undefined) patch.places_provider = b.placesProvider;
  if (b.searchProvider !== undefined) patch.search_provider = b.searchProvider;
  await updateSettings(user.id, patch);
  return NextResponse.json(await getIntegrations(user.id));
}
