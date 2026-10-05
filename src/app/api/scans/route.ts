import { NextResponse } from "next/server";
import { z } from "zod";
import { GUEST_LIMITS, authed, isGuest } from "@/lib/api";
import { CATEGORY_BY_KEY } from "@/lib/categories";
import { businessesRequestedToday, createScan, listScans } from "@/lib/db";
import { capabilityStatus } from "@/lib/keys";
import { enqueueScan, resumeAll } from "@/lib/pipeline";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  query: z.string().trim().min(2).max(200),
  radiusKm: z.number().min(0.2).max(15),
  categories: z.array(z.string()).max(50),
  maxBusinesses: z.number().int().min(1).max(150),
  includeChains: z.boolean().default(false),
  aiMode: z.enum(["deep", "standard", "off"]).default("deep"),
});

const dailyLimit = () => Math.max(1, Number(process.env.DAILY_BUSINESS_LIMIT) || 150);

export async function GET() {
  const { supabase, denied } = await authed();
  if (denied) return denied;
  resumeAll();
  return NextResponse.json(await listScans(supabase));
}

export async function POST(req: Request) {
  const { supabase, user, denied } = await authed();
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  }
  const b = parsed.data;

  // Guests can try everything the free engine does, within tighter limits.
  const guest = isGuest(user);
  if (guest && b.aiMode !== "off") {
    return NextResponse.json({ error: "AI analysis needs an account: sign up, then connect your own AI provider." }, { status: 403 });
  }
  if (guest && b.maxBusinesses > GUEST_LIMITS.maxPerScan) {
    return NextResponse.json({ error: `Guests can analyse up to ${GUEST_LIMITS.maxPerScan} businesses per scan. Sign up for bigger scans.` }, { status: 403 });
  }

  // AI work runs on the user's own keys, so check they've set them up.
  const caps = await capabilityStatus(user.id);
  if (b.aiMode !== "off" && !caps.ai) {
    return NextResponse.json({ error: "Add an AI provider key on your Profile page to use AI analysis, or choose Engine only." }, { status: 400 });
  }
  if (b.aiMode === "deep" && !caps.research) {
    return NextResponse.json({ error: "Deep research needs web search: pick an AI provider with built-in search, or add a Tavily, Brave or Serper key on your Profile page." }, { status: 400 });
  }

  const used = await businessesRequestedToday(supabase);
  const limit = guest ? GUEST_LIMITS.perDay() : dailyLimit();
  if (used + b.maxBusinesses > limit) {
    const left = Math.max(0, limit - used);
    return NextResponse.json(
      { error: left
          ? `Daily limit: you can analyse ${left} more business${left === 1 ? "" : "es"} today. Lower the count or try tomorrow.`
          : guest ? "You've used today's guest allowance. Sign up to keep scanning." : "You've reached today's analysis limit. Try again tomorrow." },
      { status: 429 },
    );
  }

  const scan = await createScan(admin(), user.id, {
    query: b.query,
    radiusM: Math.round(b.radiusKm * 1000),
    categories: b.categories.filter((c) => CATEGORY_BY_KEY[c]),
    maxBusinesses: b.maxBusinesses,
    includeChains: b.includeChains,
    aiMode: b.aiMode,
  });
  enqueueScan(scan.id);
  return NextResponse.json(scan, { status: 201 });
}
