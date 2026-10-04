import type { Metadata } from "next";
import { KeyVault } from "@/components/profile/KeyVault";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "Profile · Find Your Client" };

export default function ProfilePage() {
  return (
    <main className="relative mx-auto max-w-5xl px-4 pt-28 pb-24 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(111,92,255,0.16),transparent_60%)]" />
      <p className="text-sm font-medium tracking-wide text-violet uppercase">Account</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Your profile</h1>
      <div className="mt-8 space-y-8">
        <ProfileForm />
        <KeyVault />
      </div>
    </main>
  );
}
