import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORY_BY_KEY } from "@/lib/categories";
import { createScan, listScans } from "@/lib/db";
import { enqueueScan, resumeAll } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const Body = z.object({
  query: z.string().trim().min(2).max(200),
  radiusKm: z.number().min(0.2).max(15),
  categories: z.array(z.string()).max(50),
  maxBusinesses: z.number().int().min(1).max(150),
  includeChains: z.boolean().default(false),
  aiMode: z.enum(["deep", "standard", "off"]).default("deep"),
});

export function GET() {
  resumeAll();
  return NextResponse.json(listScans());
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  }
  const b = parsed.data;
  const scan = createScan({
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
