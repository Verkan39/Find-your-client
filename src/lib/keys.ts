import { decryptSecret, encryptSecret, keyHint } from "./crypto";
import type { LlmConfig } from "./llm";
import type { PlacesConfig } from "./places";
import {
  PROVIDERS,
  type CapabilityStatus,
  type IntegrationsView,
  type LlmProvider,
  type PlacesProvider,
  type ProviderId,
  type SearchChoice,
  type SearchProvider,
} from "./providers/catalog";
import type { SearchConfig } from "./search";
import { admin } from "./supabase/admin";

/**
 * Storage for each user's provider keys and choices. Always goes through the
 * admin client: api_keys has no RLS policies, so nothing else can read it.
 * Keys are encrypted before they reach the database and only decrypted in
 * memory, server-side, when a scan runs.
 */

interface KeyRow {
  provider: ProviderId;
  encrypted_key: string;
  key_hint: string;
  base_url: string | null;
  verified_at: string | null;
}

interface SettingsRow {
  llm_provider: LlmProvider | null;
  llm_model: string | null;
  places_provider: PlacesProvider | null;
  search_provider: SearchChoice | null;
}

const EMPTY_SETTINGS: SettingsRow = { llm_provider: null, llm_model: null, places_provider: null, search_provider: null };

async function keyRows(userId: string): Promise<KeyRow[]> {
  const { data, error } = await admin().from("api_keys").select("provider, encrypted_key, key_hint, base_url, verified_at").eq("user_id", userId);
  if (error) throw new Error(`Couldn't load API keys: ${error.message}`);
  return (data ?? []) as KeyRow[];
}

async function settingsRow(userId: string): Promise<SettingsRow> {
  const { data, error } = await admin().from("user_settings").select("llm_provider, llm_model, places_provider, search_provider").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Couldn't load settings: ${error.message}`);
  return (data as SettingsRow) ?? EMPTY_SETTINGS;
}

export async function getIntegrations(userId: string): Promise<IntegrationsView> {
  const [rows, s] = await Promise.all([keyRows(userId), settingsRow(userId)]);
  return {
    keys: Object.fromEntries(rows.map((r) => [r.provider, { hint: r.key_hint, baseUrl: r.base_url, verifiedAt: r.verified_at }])),
    settings: { llmProvider: s.llm_provider, llmModel: s.llm_model, placesProvider: s.places_provider, searchProvider: s.search_provider },
  };
}

export async function saveKey(userId: string, provider: ProviderId, key: string, baseUrl: string | null) {
  const { error } = await admin().from("api_keys").upsert(
    {
      user_id: userId,
      provider,
      encrypted_key: encryptSecret(key.trim()),
      key_hint: keyHint(key),
      base_url: baseUrl,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(`Couldn't save the key: ${error.message}`);
}

/** Remove a key and un-select its provider if it was in use. */
export async function deleteKey(userId: string, provider: ProviderId) {
  const { error } = await admin().from("api_keys").delete().eq("user_id", userId).eq("provider", provider);
  if (error) throw new Error(`Couldn't delete the key: ${error.message}`);
  const s = await settingsRow(userId);
  const patch: Partial<SettingsRow> = {};
  if (s.llm_provider === provider) Object.assign(patch, { llm_provider: null, llm_model: null });
  if (s.places_provider === provider) patch.places_provider = null;
  if (s.search_provider === provider) patch.search_provider = null;
  if (Object.keys(patch).length) await updateSettings(userId, patch);
}

export async function updateSettings(userId: string, patch: Partial<SettingsRow>) {
  const { error } = await admin().from("user_settings").upsert({ user_id: userId, ...(await settingsRow(userId)), ...patch }, { onConflict: "user_id" });
  if (error) throw new Error(`Couldn't save settings: ${error.message}`);
}

/* --------------------------- runtime configuration -------------------------- */

export interface UserConfig {
  llm: LlmConfig | null;
  places: PlacesConfig | null;
  search: SearchConfig | null;
  /** How deep research gets its web results, or null if it can't run. */
  research: "native" | "search" | null;
  /** When native research fails, can we fall back to a search API? */
  researchFallback: boolean;
}

/** Decrypt a user's keys for one scan. Keys that fail to decrypt are skipped. */
export async function loadUserConfig(userId: string): Promise<UserConfig> {
  const [rows, s] = await Promise.all([keyRows(userId), settingsRow(userId)]);
  const keys = new Map<ProviderId, { key: string; baseUrl: string | null }>();
  for (const r of rows) {
    try {
      keys.set(r.provider, { key: decryptSecret(r.encrypted_key), baseUrl: r.base_url });
    } catch {
      console.warn(`[keys] couldn't decrypt ${r.provider} key for ${userId}; was KEYS_ENCRYPTION_SECRET changed?`);
    }
  }

  const llmKey = s.llm_provider ? keys.get(s.llm_provider) : undefined;
  const llm: LlmConfig | null =
    s.llm_provider && s.llm_model && llmKey ? { provider: s.llm_provider, model: s.llm_model, key: llmKey.key, baseUrl: llmKey.baseUrl } : null;

  const placesKey = s.places_provider ? keys.get(s.places_provider) : undefined;
  const places = s.places_provider && placesKey ? { provider: s.places_provider, key: placesKey.key } : null;

  // Search: the explicit choice, else the first search key the user saved.
  const searchIds: SearchProvider[] = ["tavily", "brave", "serper"];
  const chosen = s.search_provider && s.search_provider !== "native" ? s.search_provider : searchIds.find((id) => keys.has(id));
  const search = chosen && keys.get(chosen) ? { provider: chosen, key: keys.get(chosen)!.key } : null;

  const native = Boolean(llm && PROVIDERS[llm.provider].nativeSearch);
  const preferSearch = s.search_provider && s.search_provider !== "native" && search;
  const research = !llm ? null : preferSearch ? "search" : native ? "native" : search ? "search" : null;

  return { llm, places, search, research, researchFallback: research === "native" && Boolean(search) };
}

/** What the dashboard may know about a user's setup. No secrets. */
export async function capabilityStatus(userId: string): Promise<CapabilityStatus> {
  const cfg = await loadUserConfig(userId);
  return {
    ai: cfg.llm ? { provider: cfg.llm.provider, providerName: PROVIDERS[cfg.llm.provider].name, model: cfg.llm.model } : null,
    places: cfg.places ? { provider: cfg.places.provider, providerName: PROVIDERS[cfg.places.provider].name } : null,
    research:
      cfg.research === "native" ? { via: "native", name: `${PROVIDERS[cfg.llm!.provider].name} web search` }
      : cfg.research === "search" ? { via: cfg.search!.provider, name: PROVIDERS[cfg.search!.provider].name }
      : null,
  };
}
