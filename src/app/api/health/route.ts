import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe for the hosting platform. Cheap on purpose: no database call. */
export function GET() {
  return NextResponse.json({ ok: true });
}
