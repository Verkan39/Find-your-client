import { NextResponse } from "next/server";
import { authed, notFound } from "@/lib/api";
import { getBusiness, getScan, peerStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, denied } = await authed();
  if (denied) return denied;
  const { id } = await params;
  const business = await getBusiness(supabase, id); // RLS: null unless it's yours
  if (!business) return notFound();
  const [scan, peers] = await Promise.all([getScan(supabase, business.scanId), peerStats(supabase, business)]);
  return NextResponse.json({ business, scan, peers });
}
