import { NextResponse } from "next/server";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/* Per-IP limit so the endpoint can't be used to sweep through email lists. */
const g = globalThis as unknown as { __fycEmailChecks?: Map<string, { n: number; until: number }> };
const hits = (g.__fycEmailChecks ??= new Map());
const LIMIT = 20;
const WINDOW_MS = 10 * 60 * 1000;

const Body = z.object({ email: z.string().trim().email().max(320) });

/** Signup step 1: is this email already registered? */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && h.until > now && h.n >= LIMIT) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }
  hits.set(ip, { n: (h && h.until > now ? h.n : 0) + 1, until: h && h.until > now ? h.until : now + WINDOW_MS });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const { data, error } = await admin().rpc("email_registered", { p_email: parsed.data.email });
  if (error) return NextResponse.json({ error: "Couldn't check that email right now." }, { status: 500 });
  return NextResponse.json({ available: !data });
}
