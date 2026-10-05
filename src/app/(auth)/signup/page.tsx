import type { Metadata } from "next";
import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/forms";
import { safeNext } from "@/lib/safe-next";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign up · Find Your Client" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  const { user } = await getUser().catch(() => ({ user: null }));
  const guest = Boolean(user?.is_anonymous);
  return (
    <AuthShell
      wide
      title={guest ? "Save your results" : "Find your next client"}
      subtitle={guest ? "Create a free account to keep your scans, connect AI and run bigger searches." : "Create a free account. Your scans and leads are saved to it."}
      footer={<>Already have an account? <AuthLink href={`/login?next=${encodeURIComponent(next)}`}>Log in</AuthLink></>}
    >
      <SignupForm next={next} guest={guest} />
    </AuthShell>
  );
}
