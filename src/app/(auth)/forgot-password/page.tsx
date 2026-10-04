import type { Metadata } from "next";
import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset password · Find Your Client" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one." footer={<>Remembered it? <AuthLink href="/login">Log in</AuthLink></>}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
