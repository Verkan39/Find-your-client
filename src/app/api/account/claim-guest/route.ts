import { NextResponse } from "next/server";
import { authed, badRequest, isGuest } from "@/lib/api";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * A guest just logged into an existing account: move their guest scans over.
 * The browser proves it owned the guest session by sending that session's
 * access token, which we verify with Supabase before touching anything.
 */
export async function POST(req: Request) {
  const { user, denied } = await authed();
  if (denied) return denied;
  if (isGuest(user)) return badRequest("Log in to a full account first.");

  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return badRequest("Missing guest session.");

  const { data, error } = await admin().auth.getUser(token);
  const guest = data.user;
  if (error || !guest) return NextResponse.json({ error: "Guest session expired." }, { status: 410 });
  if (!guest.is_anonymous || guest.id === user.id) return badRequest("Not a guest session.");

  const { data: moved, error: rpcError } = await admin().rpc("transfer_guest_data", { p_guest: guest.id, p_owner: user.id });
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });
  return NextResponse.json({ moved });
}
