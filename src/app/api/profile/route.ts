import { NextResponse } from "next/server";
import { authed } from "@/lib/api";
import { ProfileSchema, profileFromRow, profileToRow } from "@/lib/profile";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user, denied } = await authed();
  if (denied) return denied;
  const { data, error } = await supabase.from("profiles").select().eq("id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(profileFromRow(data ?? {}, user.email ?? ""));
}

export async function PATCH(req: Request) {
  const { supabase, user, denied } = await authed();
  if (denied) return denied;
  const parsed = ProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  // RLS: this update can only ever touch the caller's own row.
  const { data, error } = await supabase.from("profiles").update(profileToRow(parsed.data)).eq("id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Keep the auth metadata name in sync (used by the nav).
  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });
  return NextResponse.json(profileFromRow(data, user.email ?? ""));
}
