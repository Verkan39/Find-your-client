import { NextResponse } from "next/server";
import { authed, notFound } from "@/lib/api";
import { getBusiness } from "@/lib/db";
import { reanalyze } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, denied } = await authed();
  if (denied) return denied;
  const { id } = await params;
  if (!(await getBusiness(supabase, id))) return notFound(); // ownership check
  const { fresh } = (await req.json().catch(() => ({}))) as { fresh?: boolean };
  if (!(await reanalyze(id, { fresh: Boolean(fresh) }))) return notFound();
  return NextResponse.json({ ok: true });
}
