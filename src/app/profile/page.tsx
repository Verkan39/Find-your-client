import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Save, UserRound } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { KeyVault } from "@/components/profile/KeyVault";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "Profile · Find Your Client" };

export default async function ProfilePage() {
  const { user } = await getUser();
  if (user?.is_anonymous) return <GuestProfile />;
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

/** Guests have no profile or keys yet: explain what an account unlocks. */
function GuestProfile() {
  const perks = [
    { Icon: Save, title: "Keep your results", body: "Scans you ran as a guest move into your account instead of being deleted after 24 hours." },
    { Icon: KeyRound, title: "Connect your own AI", body: "Claude, OpenAI, Gemini and more, for web research and AI-written pitches." },
    { Icon: UserRound, title: "Bigger scans", body: "Up to 100 businesses per scan, plus a profile you can tailor." },
  ];
  return (
    <main className="relative mx-auto max-w-3xl px-4 pt-28 pb-24 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(111,92,255,0.16),transparent_60%)]" />
      <p className="text-sm font-medium tracking-wide text-violet uppercase">Guest session</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Make it yours</h1>
      <p className="mt-3 text-fg-muted">You're exploring without an account. Create one (free) to unlock everything below.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {perks.map(({ Icon, title, body }) => (
          <div key={title} className="glass rounded-2xl p-5">
            <Icon className="size-5 text-violet" />
            <div className="mt-3 font-medium">{title}</div>
            <p className="mt-1 text-sm text-fg-muted">{body}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="rounded-full bg-fg px-6 py-3 font-medium text-ink-950 transition hover:bg-white">Create free account</Link>
        <Link href="/login" className="rounded-full px-6 py-3 text-fg-muted ring-1 ring-white/10 transition hover:text-fg">I already have one</Link>
      </div>
    </main>
  );
}
