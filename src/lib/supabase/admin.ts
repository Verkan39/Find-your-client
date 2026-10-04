import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, assertSupabaseEnv } from "./env";

/**
 * Privileged client for the background pipeline. It uses the secret key, which
 * bypasses row-level security, so it must never be imported into client code
 * and every query must scope by scan/business id explicitly.
 */
const g = globalThis as unknown as { __fycAdmin?: SupabaseClient };

export function admin(): SupabaseClient {
  if (g.__fycAdmin) return g.__fycAdmin;
  assertSupabaseEnv();
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set; the analysis worker needs it (see README).");
  g.__fycAdmin = createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return g.__fycAdmin;
}
