import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { UNLOCK_COOKIE, verifyUnlockToken } from "./crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getUser } from "./supabase/server";

type Authed = { supabase: SupabaseClient; user: User; denied?: undefined } | { denied: NextResponse; supabase?: undefined; user?: undefined };

/** Resolve the signed-in user for an API route, or a ready-made 401 response. */
export async function authed(): Promise<Authed> {
  const { supabase, user } = await getUser();
  if (!user) return { denied: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  return { supabase, user };
}

export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/** API-key routes also require the user to have re-entered their password recently. */
export async function unlocked(): Promise<Authed> {
  const a = await authed();
  if (a.denied) return a;
  const token = (await cookies()).get(UNLOCK_COOKIE)?.value;
  if (!verifyUnlockToken(token, a.user.id)) {
    return { denied: NextResponse.json({ error: "Enter your password to manage API keys.", locked: true }, { status: 403 }) };
  }
  return a;
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
