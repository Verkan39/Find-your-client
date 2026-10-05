"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Mail, UserRound } from "lucide-react";
import clsx from "clsx";
import { AboutFields, EMPTY_ABOUT, type AboutValue } from "@/components/profile/AboutFields";
import { ProfileSchema } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";
import { AuthLink, Field, Notice, PasswordField, StrengthMeter, SubmitButton, friendlyAuthError } from "./AuthShell";

const callbackUrl = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const sb = createClient();
    // If they were exploring as a guest, remember that session so its scans can move over.
    const { data: before } = await sb.auth.getSession();
    const guestToken = before.session?.user.is_anonymous ? before.session.access_token : null;
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(friendlyAuthError(error.message));
      setBusy(false);
      return;
    }
    if (guestToken) {
      await fetch("/api/account/claim-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: guestToken }),
      }).catch(() => {});
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" icon={<Mail className="size-4" />} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <PasswordField
        autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
        hint={<AuthLink href="/forgot-password">Forgot?</AuthLink>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <SubmitButton busy={busy}>{busy ? "Signing in…" : "Log in"}</SubmitButton>
    </form>
  );
}

export function SignupForm({ next, guest = false }: { next: string; guest?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [about, setAbout] = useState<AboutValue>(EMPTY_ABOUT);
  const [aboutErrors, setAboutErrors] = useState<Partial<Record<keyof AboutValue, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);

  async function toStep2(e: React.FormEvent) {
    e.preventDefault();
    setEmailTaken(false);
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setError(null);
    setChecking(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.available === false) {
        setEmailTaken(true);
        return;
      }
      if (res.status === 400 || res.status === 429) return setError(body.error);
      // Any other failure: carry on, signup itself will still catch a duplicate.
    } catch {
      // Network hiccup: same as above.
    } finally {
      setChecking(false);
    }
    setStep(2);
  }

  async function create(withAbout: boolean) {
    let meta: Record<string, unknown> = { full_name: name.trim() };
    if (withAbout) {
      const parsed = ProfileSchema.safeParse({ fullName: name, ...about });
      if (!parsed.success) {
        const fields = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
        setAboutErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.[0] ?? ""])) as typeof aboutErrors);
        return;
      }
      const p = parsed.data;
      meta = {
        full_name: p.fullName, phone: p.phone, contact_email: p.contactEmail, headline: p.headline, location: p.location,
        experience_level: p.experienceLevel, portfolio_url: p.portfolioUrl, skills: p.skills, interests: p.interests,
      };
    }
    setAboutErrors({});
    setBusy(true);
    setError(null);
    if (guest) return upgradeGuest(withAbout);
    const { data, error } = await createClient().auth.signUp({
      email: email.trim(),
      password,
      options: { data: meta, emailRedirectTo: callbackUrl(next) },
    });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error.message));
      // Account problems (email taken, weak password) are fixed on step 1.
      if (!/network|reach/i.test(error.message)) setStep(1);
      return;
    }
    if (data.session) {
      // Email confirmation is off: they're signed in already.
      router.replace(next);
      router.refresh();
    } else {
      setSentTo(email.trim());
    }
  }

  /**
   * A guest is already a (temporary) user: attach an email and password to that
   * same account instead of creating a new one, so every scan stays with them.
   */
  async function upgradeGuest(withAbout: boolean) {
    const sb = createClient();
    // Their profile row exists already (created with the guest session).
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withAbout ? { fullName: name, ...about } : { ...EMPTY_ABOUT, fullName: name }),
    }).catch(() => {});

    const { data, error } = await sb.auth.updateUser(
      { email: email.trim(), data: { full_name: name.trim() } },
      { emailRedirectTo: callbackUrl("/reset-password?welcome=1") },
    );
    if (error) {
      setBusy(false);
      setError(friendlyAuthError(error.message));
      setStep(1);
      return;
    }
    if (data.user?.email?.toLowerCase() === email.trim().toLowerCase()) {
      // Email confirmation is off: the account is permanent now; set the password.
      const { error: pwError } = await sb.auth.updateUser({ password });
      setBusy(false);
      if (pwError) return setError(friendlyAuthError(pwError.message));
      router.replace(next);
      router.refresh();
      return;
    }
    // Confirmation is on: the password is chosen after they click the link.
    setBusy(false);
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <Notice tone="success">
        <p className="font-medium">Check your inbox</p>
        {guest ? (
          <p className="mt-1 text-fg-muted">We sent a link to <span className="text-fg">{sentTo}</span>. Click it to confirm your email, then choose a password. Your guest scans are saved to the account automatically.</p>
        ) : (
          <p className="mt-1 text-fg-muted">We sent a confirmation link to <span className="text-fg">{sentTo}</span>. Click it to activate your account, then you'll land on your dashboard.</p>
        )}
      </Notice>
    );
  }

  return (
    <div>
      {guest && (
        <div className="mb-5 flex gap-2.5 rounded-xl bg-lime/[0.07] px-3.5 py-3 text-sm text-fg-muted ring-1 ring-lime/20">
          <Check className="mt-0.5 size-4 shrink-0 text-lime" />
          <span>Everything you ran as a guest will be saved to your new account.</span>
        </div>
      )}
      <ol className="mb-6 flex items-center gap-2 text-xs" aria-label="Signup steps">
        {["Account", "About you"].map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full font-medium ring-1 transition",
                active ? "bg-violet text-ink-950 ring-violet" : done ? "bg-lime/20 text-lime ring-lime/40" : "text-fg-faint ring-white/15")}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
              </span>
              <span className={active ? "text-fg" : "text-fg-faint"}>{label}</span>
              {i === 0 && <span className="mx-1 h-px flex-1 bg-white/10" />}
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        {step === 1 ? (
          <motion.form key="s1" onSubmit={toStep2} className="space-y-4" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            <Field label="Name" icon={<UserRound className="size-4" />} autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Field label="Email" icon={<Mail className="size-4" />} type="email" autoComplete="email" required value={email} onChange={(e) => { setEmail(e.target.value); setEmailTaken(false); }} placeholder="you@example.com" />
            <div>
              <PasswordField autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              <StrengthMeter password={password} />
            </div>
            {emailTaken && (
              <Notice tone="error">
                An account with this email already exists.{" "}
                <AuthLink href={`/login?next=${encodeURIComponent(next)}`}>Log in instead</AuthLink>
              </Notice>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            <SubmitButton busy={checking}>{checking ? "Checking…" : "Continue"}</SubmitButton>
          </motion.form>
        ) : (
          <motion.form key="s2" onSubmit={(e) => { e.preventDefault(); create(true); }} className="space-y-5" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
            <p className="text-sm text-fg-muted">Optional. Helps tailor your experience, and you can change it later on your profile.</p>
            <AboutFields value={about} onChange={setAbout} errors={aboutErrors} />
            {error && <Notice tone="error">{error}</Notice>}
            <SubmitButton busy={busy}>{busy ? "Creating account…" : "Create account"}</SubmitButton>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-fg-muted transition hover:text-fg">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button type="button" disabled={busy} onClick={() => create(false)} className="text-fg-muted underline-offset-4 transition hover:text-fg hover:underline">
                Skip for now
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: callbackUrl("/reset-password") });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error.message));
    setSent(true);
  }

  if (sent) {
    return <Notice tone="success">If an account exists for <span className="text-fg">{email}</span>, a reset link is on its way.</Notice>;
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" icon={<Mail className="size-4" />} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      {error && <Notice tone="error">{error}</Notice>}
      <SubmitButton busy={busy}>{busy ? "Sending…" : "Send reset link"}</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError(friendlyAuthError(error.message));
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <PasswordField label="New password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        <StrengthMeter password={password} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <SubmitButton busy={busy}>{busy ? "Saving…" : "Update password"}</SubmitButton>
    </form>
  );
}
