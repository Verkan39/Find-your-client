import { NextResponse } from "next/server";
import { getBusiness, getScan } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = getBusiness(id);
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ business, scan: getScan(business.scanId) });
}
