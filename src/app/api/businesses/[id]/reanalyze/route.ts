import { NextResponse } from "next/server";
import { reanalyze } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { fresh } = (await req.json().catch(() => ({}))) as { fresh?: boolean };
  if (!reanalyze(id, { fresh: Boolean(fresh) })) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
