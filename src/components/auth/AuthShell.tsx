"use client";

import Link from "next/link";
import { useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Radar } from "lucide-react";
import clsx from "clsx";
import { HeroScene } from "@/components/three";
import { Magnetic } from "@/components/PointerFX";
import { Spinner } from "@/components/ui";

/** Split-screen frame for every auth page: form on the left, the live globe on the right. */
export function AuthShell({ title, subtitle, children, footer, wide }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const side = useRef<HTMLDivElement>(null);
  return (
    <main className="relative grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_20%,rgba(111,92,255,0.14),transparent_55%)]" />

      <section className="flex items-center justify-center px-4 pt-24 pb-12 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }} className={clsx("w-full", wide ? "max-w-lg" : "max-w-md")}>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-fg-muted">{subtitle}</p>
          <div className="glass ring-gradient mt-8 rounded-3xl p-6 sm:p-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
        </motion.div>
      </section>

      <section ref={side} className="relative hidden overflow-hidden border-l border-white/5 lg:block">
        <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />
        <div className="absolute inset-0 -left-[30%]">
          <HeroScene container={side} />
        </div>
        <div className="pointer-events-none absolute inset-x-10 bottom-12">
          <div className="glass inline-flex items-center gap-3 rounded-2xl px-4 py-3">
            <Radar className="size-4 text-lime" />
            <p className="text-sm text-fg-muted">Every independent business nearby, scored and ready to pitch.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export function Field({ label, icon, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm"><span className="text-fg-muted">{label}</span>{hint}</span>
      <span className="flex items-center gap-2.5 rounded-xl bg-ink-900/70 px-3.5 ring-1 ring-white/10 transition focus-within:ring-violet/60">
        {icon && <span className="text-fg-faint">{icon}</span>}
        <input {...props} className="h-12 w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-fg-faint" />
      </span>
    </label>
  );
}

export function PasswordField({ label = "Password", hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm"><span className="text-fg-muted">{label}</span>{hint}</span>
      <span className="flex items-center gap-2 rounded-xl bg-ink-900/70 pr-1.5 pl-3.5 ring-1 ring-white/10 transition focus-within:ring-violet/60">
        <input {...props} type={show ? "text" : "password"} className="h-12 w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-fg-faint" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="grid size-9 shrink-0 place-items-center rounded-lg text-fg-faint transition hover:bg-white/5 hover:text-fg">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}

/** Four-segment strength meter; purely advisory, the server enforces the minimum. */
export function StrengthMeter({ password }: { password: string }) {
  const checks = [password.length >= 8, /[A-Z]/.test(password) && /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password) || password.length >= 14];
  const score = password ? checks.filter(Boolean).length : 0;
  const label = ["", "Weak", "Fair", "Good", "Strong"][score];
  const color = ["", "bg-rose", "bg-amber", "bg-cyan", "bg-lime"][score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={clsx("h-1 flex-1 rounded-full transition-colors", i < score ? color : "bg-white/[0.07]")} />)}</div>
      <div className="mt-1 h-4 text-xs text-fg-faint">{password && `${label}${password.length < 8 ? " · at least 8 characters" : ""}`}</div>
    </div>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <Magnetic className="mt-2 block" strength={0.15}>
      <button disabled={busy} className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet to-cyan font-medium text-ink-950 shadow-[0_10px_40px_-12px] shadow-violet transition hover:brightness-110 disabled:opacity-60">
        {busy ? <Spinner className="border-ink-950/20 border-t-ink-950" /> : null}
        {children}
        {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
    </Magnetic>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
        role={tone === "error" ? "alert" : "status"}
        className={clsx("flex gap-2.5 rounded-xl px-3.5 py-3 text-sm ring-1", tone === "error" ? "bg-rose/10 text-rose ring-rose/25" : "bg-lime/10 text-lime ring-lime/25")}
      >
        {tone === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
        <div>{children}</div>
      </motion.div>
    </AnimatePresence>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-medium text-violet transition hover:text-fg">{children}</Link>;
}

/** Map Supabase auth errors to plain language. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Check them and try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Try logging in.";
  if (m.includes("password should be") || m.includes("password is too")) return message;
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("fetch")) return "Couldn't reach the server. Check your connection.";
  return message;
}
