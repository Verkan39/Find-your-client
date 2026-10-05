"use client";

import { api } from "@/lib/fetcher";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bot, Check, Layers, Lock, MapPin, Zap } from "lucide-react";
import clsx from "clsx";
import { CATEGORIES, GROUPS } from "@/lib/categories";
import type { AiMode, SystemStatus } from "@/lib/types";
import { Magnetic } from "./PointerFX";
import { Spinner } from "./ui";

const SIZES = [10, 25, 50, 100];
const GUEST_MAX = 10;

const AI_MODES: { key: AiMode; label: string; desc: string; icon: typeof Bot }[] = [
  { key: "deep", label: "Deep research", desc: "Searches the web for each business, then writes the brief. Slowest, most accurate.", icon: Bot },
  { key: "standard", label: "AI brief", desc: "AI writes the brief from the website audit and map data. No web search.", icon: Zap },
  { key: "off", label: "Engine only", desc: "Built-in scoring engine. Free and fast, but less nuanced.", icon: Layers },
];

/** Why a mode can't be used with the user's current setup, if it can't. */
function blocked(mode: AiMode, status: SystemStatus | null): string | null {
  if (!status || mode === "off") return null;
  if (status.guest) return "Sign up to use AI";
  if (!status.ai) return "Add an AI key on your Profile";
  if (mode === "deep" && !status.research) return "Add a web search key on your Profile";
  return null;
}

export function NewScanForm({ status }: { status: SystemStatus | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(1.5);
  const [max, setMax] = useState(25);
  const guest = Boolean(status?.guest);
  const effectiveMax = guest ? Math.min(max, GUEST_MAX) : max;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeChains, setIncludeChains] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>("deep");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fall back to the best mode the user's setup supports.
  const effectiveMode: AiMode = !blocked(aiMode, status) ? aiMode : !blocked("standard", status) ? "standard" : "off";
  const byGroup = useMemo(() => GROUPS.map((g) => ({ g, cats: CATEGORIES.filter((c) => c.group === g) })), []);

  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const toggleGroup = (keys: string[]) =>
    setSelected((s) => {
      const n = new Set(s);
      const all = keys.every((k) => n.has(k));
      keys.forEach((k) => (all ? n.delete(k) : n.add(k)));
      return n;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, radiusKm, categories: [...selected], maxBusinesses: effectiveMax, includeChains, aiMode: effectiveMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start scan");
      router.push(`/scans/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass ring-gradient relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-violet/20 blur-3xl" />
      <h2 className="font-display text-2xl font-semibold tracking-tight">New scan</h2>
      <p className="mt-1 text-sm text-fg-muted">Where are you looking for clients?</p>

      <label className="mt-6 block">
        <span className="sr-only">Region</span>
        <div className="group flex items-center gap-3 rounded-2xl bg-ink-900/70 px-4 ring-1 ring-white/10 transition focus-within:ring-violet/60">
          <MapPin className="size-5 text-violet" />
          <input
            required
            minLength={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Koramangala, Bengaluru  ·  Shoreditch, London  ·  Williamsburg, Brooklyn"
            className="h-14 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-fg-faint"
          />
        </div>
      </label>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-fg-muted">Radius</span>
            <span className="font-medium tabular-nums">{radiusKm.toFixed(1)} km</span>
          </div>
          <input type="range" min={0.3} max={6} step={0.1} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <div className="mb-2 text-sm text-fg-muted">Businesses to analyse in depth</div>
          <div className="flex gap-2">
            {SIZES.map((n) => {
              const locked = guest && n > GUEST_MAX;
              return (
                <button type="button" key={n} disabled={locked} onClick={() => setMax(n)} title={locked ? "Sign up for bigger scans" : undefined}
                  className={clsx("inline-flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40",
                    effectiveMax === n ? "bg-fg text-ink-950 ring-fg" : "bg-white/[0.03] text-fg-muted ring-white/10 hover:text-fg")}>
                  {locked && <Lock className="size-3" />}{n}
                </button>
              );
            })}
          </div>
          {guest && <p className="mt-2 text-xs text-fg-faint">Guests can analyse up to {GUEST_MAX} businesses per scan. <Link href="/signup" className="text-violet hover:underline">Sign up</Link> for more.</p>}
        </div>
      </div>

      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-fg-muted">Categories <span className="text-fg-faint">({selected.size ? `${selected.size} selected` : "all"})</span></span>
          {selected.size > 0 && <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-violet hover:underline">Clear</button>}
        </div>
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {byGroup.map(({ g, cats }) => (
            <div key={g} className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => toggleGroup(cats.map((c) => c.key))} className="mr-1 w-full shrink-0 text-left text-xs font-medium text-fg-faint hover:text-fg sm:w-32">
                {g}
              </button>
              {cats.map((c) => {
                const on = selected.has(c.key);
                return (
                  <button type="button" key={c.key} onClick={() => toggle(c.key)} className={clsx("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ring-1 transition", on ? "bg-violet/20 text-fg ring-violet/50" : "bg-white/[0.03] text-fg-muted ring-white/10 hover:text-fg")}>
                    {on && <Check className="size-3" />}
                    {c.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-7">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-fg-muted">Analysis depth</span>
          {status?.ai && <span className="text-xs text-fg-faint">AI usage is billed to your {status.ai.providerName} account</span>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {AI_MODES.map((m) => {
            const reason = blocked(m.key, status);
            const disabled = Boolean(reason);
            const on = effectiveMode === m.key;
            return (
              <button
                type="button" key={m.key} disabled={disabled} onClick={() => setAiMode(m.key)}
                className={clsx("relative rounded-2xl p-4 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-40", on ? "bg-violet/15 ring-violet/60" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.04]")}
              >
                <m.icon className={clsx("size-4", on ? "text-violet" : "text-fg-muted")} />
                <div className="mt-2 text-sm font-medium">{m.label}</div>
                <div className="mt-1 text-xs leading-relaxed text-fg-muted">{m.desc}</div>
                {reason && <div className="mt-2 text-[11px] text-amber">{reason}</div>}
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-6 flex cursor-pointer items-center gap-3 text-sm text-fg-muted">
        <input type="checkbox" checked={includeChains} onChange={(e) => setIncludeChains(e.target.checked)} className="size-4 accent-violet" />
        Include chain / franchise outlets <span className="text-fg-faint">(usually not worth pitching)</span>
      </label>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 rounded-xl bg-rose/10 px-4 py-3 text-sm text-rose ring-1 ring-rose/25">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <Magnetic className="mt-7 block sm:inline-block" strength={0.2}>
      <button disabled={busy || query.trim().length < 2} className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet to-cyan py-4 font-medium text-ink-950 shadow-[0_10px_40px_-10px] shadow-violet transition hover:brightness-110 disabled:opacity-50 sm:w-auto sm:px-8">
        {busy ? <Spinner className="border-ink-950/20 border-t-ink-950" /> : null}
        {busy ? "Starting…" : "Launch scan"}
        {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
      </Magnetic>
    </form>
  );
}
