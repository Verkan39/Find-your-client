import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { authed } from "@/lib/api";
import { UNLOCK_COOKIE, UNLOCK_TTL_SECONDS, createUnlockToken, verifyUnlockToken } from "@/lib/crypto";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/* Simple per-user brute-force guard: 5 wrong passwords per 15 minutes. */
const g = globalThis as unknown as { __fycUnlockAttempts?: Map<string, { n: number; until: number }> };
const attempts = (g.__fycUnlockAttempts ??= new Map());
const WINDOW_MS = 15 * 60 * 1000;

/** Is the key vault currently unlocked for this user? */
export async function GET() {
  const { user, denied } = await authed();
  if (denied) return denied;
  const token = (await cookies()).get(UNLOCK_COOKIE)?.value;
  const ok = verifyUnlockToken(token, user.id);
  const exp = ok ? Number(token!.split(".")[1]) * 1000 : null;
  return NextResponse.json({ unlocked: ok, expiresAt: exp });
}

/** Re-enter your password to unlock API-key management for 15 minutes. */
export async function POST(req: Request) {
  const { user, denied } = await authed();
  if (denied) return denied;
  if (!user.email) return NextResponse.json({ error: "This account has no password." }, { status: 400 });

  const now = Date.now();
  const a = attempts.get(user.id);
  if (a && a.until > now && a.n >= 5) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password) return NextResponse.json({ error: "Enter your password." }, { status: 400 });

  // Verify with a throwaway client so the user's own session isn't touched.
  const probe = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await probe.auth.signInWithPassword({ email: user.email, password });
  if (error) {
    attempts.set(user.id, { n: (a && a.until > now ? a.n : 0) + 1, until: now + WINDOW_MS });
    // 403, not 401: the session is fine, only this password check failed.
    return NextResponse.json({ error: "That password isn't right." }, { status: 403 });
  }
  // End only the probe session we just created.
  await probe.auth.signOut({ scope: "local" });
  attempts.delete(user.id);

  const res = NextResponse.json({ unlocked: true, expiresAt: now + UNLOCK_TTL_SECONDS * 1000 });
  res.cookies.set(UNLOCK_COOKIE, createUnlockToken(user.id), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  });
  return res;
}

/** Lock again. */
export async function DELETE() {
  const res = NextResponse.json({ unlocked: false });
  res.cookies.set(UNLOCK_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
