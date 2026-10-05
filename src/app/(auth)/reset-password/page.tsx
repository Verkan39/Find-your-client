import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Choose a new password · Find Your Client" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const welcome = (await searchParams).welcome === "1";
  return (
    <AuthShell
      title={welcome ? "Choose your password" : "Choose a new password"}
      subtitle={welcome ? "Your email is confirmed and your guest scans are saved. Set a password to finish." : "You're signed in from the reset link. Pick something you haven't used before."}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
