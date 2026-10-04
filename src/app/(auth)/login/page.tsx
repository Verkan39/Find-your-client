import type { Metadata } from "next";
import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/forms";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Log in · Find Your Client" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see your scans and leads."
      footer={<>New here? <AuthLink href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</AuthLink></>}
    >
      {sp.error && <p className="mb-4 rounded-xl bg-rose/10 px-3.5 py-3 text-sm text-rose ring-1 ring-rose/25">That link is invalid or has expired. Please try again.</p>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
