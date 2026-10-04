import { NextResponse } from "next/server";
import { unlocked } from "@/lib/api";
import { getIntegrations } from "@/lib/keys";

export const dynamic = "force-dynamic";

/** Saved keys (hints only) and provider choices. Requires an unlocked session. */
export async function GET() {
  const { user, denied } = await unlocked();
  if (denied) return denied;
  return NextResponse.json(await getIntegrations(user.id));
}
