import { NextResponse } from "next/server";
import { badRequest, unlocked } from "@/lib/api";
import { listModels } from "@/lib/llm";
import { decryptSecret } from "@/lib/crypto";
import { PROVIDERS, isProviderId, type LlmProvider } from "@/lib/providers/catalog";
import { ProviderError } from "@/lib/providers/http";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Models available to the user's saved key for one AI provider. */
export async function GET(req: Request) {
  const { user, denied } = await unlocked();
  if (denied) return denied;
  const provider = new URL(req.url).searchParams.get("provider") ?? "";
  if (!isProviderId(provider) || PROVIDERS[provider].kind !== "llm") return badRequest("Unknown AI provider");

  const { data } = await admin().from("api_keys").select("encrypted_key, base_url").eq("user_id", user.id).eq("provider", provider).maybeSingle();
  if (!data) return NextResponse.json({ error: "No key saved for this provider" }, { status: 404 });
  try {
    const models = await listModels(provider as LlmProvider, decryptSecret(data.encrypted_key), data.base_url);
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ProviderError ? e.message : String(e) }, { status: 400 });
  }
}

