import type { Metadata } from "next";
import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/forms";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign up · Find Your Client" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  return (
    <AuthShell
      wide
      title="Find your next client"
      subtitle="Create a free account. Your scans and leads are saved to it."
      footer={<>Already have an account? <AuthLink href={`/login?next=${encodeURIComponent(next)}`}>Log in</AuthLink></>}
    >
      <SignupForm next={next} />
    </AuthShell>
  );
}
