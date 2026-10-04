import { NextResponse } from "next/server";
import { MODEL, aiEnabled } from "@/lib/ai";
import { googleEnabled } from "@/lib/google";
import type { SystemStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET() {
  const status: SystemStatus = { ai: aiEnabled(), google: googleEnabled(), model: MODEL };
  return NextResponse.json(status);
}
