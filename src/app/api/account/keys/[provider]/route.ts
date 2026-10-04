import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, unlocked } from "@/lib/api";
import { deleteKey, getIntegrations, saveKey, updateSettings } from "@/lib/keys";
import { listModels } from "@/lib/llm";
import { validatePlacesKey } from "@/lib/places";
import { PROVIDERS, isProviderId, type LlmProvider, type PlacesProvider, type SearchProvider } from "@/lib/providers/catalog";
import { ProviderError } from "@/lib/providers/http";
import { validateSearchKey } from "@/lib/search";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ provider: string }> };

const Body = z.object({
  key: z.string().trim().min(8, "That key looks too short").max(500),
  baseUrl: z.string().trim().url().max(300).optional(),
});

/**
 * Test a key against the provider, then store it encrypted. For AI providers the
 * response includes the models this key can use. The key is never echoed back.
 */
export async function PUT(req: Request, { params }: Ctx) {
  const { user, denied } = await unlocked();
  if (denied) return denied;
  const { provider } = await params;
  if (!isProviderId(provider)) return badRequest("Unknown provider");
  const info = PROVIDERS[provider];

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid key");
  const { key } = parsed.data;
  const baseUrl = info.needsBaseUrl ? parsed.data.baseUrl ?? null : null;
  if (info.needsBaseUrl) {
    if (!baseUrl || !baseUrl.startsWith("https://")) return badRequest("Enter the endpoint's https:// base URL (usually ending in /v1).");
  }

  let models: string[] = [];
  try {
    if (info.kind === "llm") models = await listModels(provider as LlmProvider, key, baseUrl);
    else if (info.kind === "places") await validatePlacesKey(provider as PlacesProvider, key);
    else await validateSearchKey({ provider: provider as SearchProvider, key });
  } catch (e) {
    // We're already on the Profile page, so drop the "update it on your Profile" hint.
    const msg = e instanceof ProviderError
      ? e.message.replace(" Update it on your Profile page.", " Check the key and try again.")
      : `Couldn't verify the key: ${e instanceof Error ? e.message : e}`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await saveKey(user.id, provider, key, baseUrl);

  // First key of a kind becomes the active choice automatically.
  const { settings } = await getIntegrations(user.id);
  if (info.kind === "llm" && (!settings.llmProvider || settings.llmProvider === provider)) {
    const keep = settings.llmProvider === provider && settings.llmModel && (models.length === 0 || models.includes(settings.llmModel));
    await updateSettings(user.id, { llm_provider: provider as LlmProvider, llm_model: keep ? settings.llmModel : models[0] ?? null });
  } else if (info.kind === "places" && !settings.placesProvider) {
    await updateSettings(user.id, { places_provider: provider as PlacesProvider });
  }

  return NextResponse.json({ ok: true, models, integrations: await getIntegrations(user.id) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { user, denied } = await unlocked();
  if (denied) return denied;
  const { provider } = await params;
  if (!isProviderId(provider)) return badRequest("Unknown provider");
  await deleteKey(user.id, provider);
  return NextResponse.json({ ok: true, integrations: await getIntegrations(user.id) });
}
