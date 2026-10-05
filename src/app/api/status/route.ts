import { NextResponse } from "next/server";
import { authed, isGuest } from "@/lib/api";
import { capabilityStatus } from "@/lib/keys";

export const dynamic = "force-dynamic";

/** The signed-in user's AI / data / research setup. No secrets. */
export async function GET() {
  const { user, denied } = await authed();
  if (denied) return denied;
  return NextResponse.json({ ...(await capabilityStatus(user.id)), guest: isGuest(user) });
}
