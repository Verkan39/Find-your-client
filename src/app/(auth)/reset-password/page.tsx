import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Choose a new password · Find Your Client" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="You're signed in from the reset link. Pick something you haven't used before.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
