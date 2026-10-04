"use client";

import { api } from "@/lib/fetcher";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, CheckCircle2, KeyRound, MapPinned, Radar, Search, Trash2 } from "lucide-react";
import { NewScanForm } from "@/components/NewScanForm";
import { ScanListSkeleton, Skel } from "@/components/skeletons";
import { Pill, Reveal, STAGE_LABEL, Spinner, TierBadge, timeAgo } from "@/components/ui";
import type { Scan, ScanCounts, SystemStatus } from "@/lib/types";

type ScanRow = Scan & { counts: ScanCounts; topOpportunity: number | null };

export default function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [scans, setScans] = useState<ScanRow[] | null>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
    let alive = true;
    const load = () => api("/api/scans").then((r) => r.json()).then((d) => alive && Array.isArray(d) && setScans(d)).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this scan and all its analysis?")) return;
    await api(`/api/scans/${id}`, { method: "DELETE" });
    setScans((s) => s?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <main className="relative mx-auto max-w-7xl px-4 pt-28 pb-24 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(111,92,255,0.18),transparent_60%)]" />

      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-wide text-violet uppercase">Dashboard</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your lead radar</h1>
          </div>
          {!status && (
            <div className="flex gap-2"><Skel className="h-6 w-36 rounded-full" /><Skel className="h-6 w-36 rounded-full" /></div>
          )}
          {status && (
            <div className="flex flex-wrap gap-2">
              <Pill tone={status.ai ? "good" : "warn"}>
                {status.ai ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                {status.ai ? `${status.ai.providerName} · ${status.ai.model}` : "No AI provider"}
              </Pill>
              <Pill tone={status.research ? "good" : "default"}>
                {status.research ? <CheckCircle2 className="size-3" /> : <Search className="size-3" />}
                {status.research ? `Research: ${status.research.name}` : "No web research"}
              </Pill>
              <Pill tone={status.places ? "good" : "default"}>
                {status.places ? <CheckCircle2 className="size-3" /> : <MapPinned className="size-3" />}
                {status.places ? `${status.places.providerName} data` : "No ratings data"}
              </Pill>
            </div>
          )}
        </div>
      </Reveal>

      {status && (!status.ai || !status.places) && (
        <Reveal delay={0.05}>
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-amber/[0.06] p-4 text-sm ring-1 ring-amber/20">
            <KeyRound className="size-4 shrink-0 text-amber" />
            <p className="min-w-0 flex-1 text-fg-muted">
              {!status.ai
                ? <><span className="text-fg">Connect your own AI provider</span> (Claude, OpenAI, Gemini and more) to unlock web research and AI-written pitches. Until then, scans use the free built-in engine.</>
                : <><span className="text-fg">Optional:</span> add a Google Places or Yelp key for ratings, review counts and review text. They make the revenue and reputation estimates sharper.</>}
            </p>
            <Link href="/profile#keys" className="shrink-0 rounded-full bg-fg px-4 py-1.5 text-xs font-medium text-ink-950 transition hover:bg-white">
              Add API keys
            </Link>
          </div>
        </Reveal>
      )}

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Reveal delay={0.1} className="min-w-0">
          <div id="new-scan" className="scroll-mt-24">
            <NewScanForm status={status} />
          </div>
        </Reveal>

        <Reveal delay={0.15} className="min-w-0">
          <div>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><Radar className="size-4 text-cyan" /> Scans</h2>
            {scans === null ? (
              <ScanListSkeleton />
            ) : scans.length === 0 ? (
              <div className="glass grid place-items-center rounded-2xl px-6 py-16 text-center">
                <MapPinned className="size-8 text-fg-faint" />
                <p className="mt-3 text-sm text-fg-muted">No scans yet. Start with a neighbourhood you know.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {scans.map((s) => {
                    const running = !["done", "failed"].includes(s.status);
                    const pct = s.counts.total ? Math.round(((s.counts.done + s.counts.failed) / s.counts.total) * 100) : 0;
                    return (
                      <motion.li key={s.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <Link href={`/scans/${s.id}`} className="group glass block rounded-2xl p-5 transition hover:bg-white/[0.05]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate font-medium">{s.label ?? s.query}</h3>
                                <ArrowUpRight className="size-4 shrink-0 text-fg-faint transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
                              </div>
                              <p className="mt-0.5 text-xs text-fg-faint">
                                {(s.radiusM / 1000).toFixed(1)} km · {s.categories.length ? `${s.categories.length} categories` : "all categories"} · {s.aiMode === "off" ? "engine" : s.aiMode === "deep" ? "deep AI" : "AI brief"} · {timeAgo(s.createdAt)}
                              </p>
                            </div>
                            <button onClick={(e) => { e.preventDefault(); remove(s.id); }} className="rounded-lg p-1.5 text-fg-faint opacity-0 transition group-hover:opacity-100 hover:bg-rose/10 hover:text-rose" aria-label="Delete scan">
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                          <div className="mt-4 flex items-center gap-3">
                            {s.status === "failed" ? (
                              <Pill tone="bad">Failed</Pill>
                            ) : running ? (
                              <Pill tone="info"><Spinner className="size-2.5 border" /> {STAGE_LABEL[s.status]}</Pill>
                            ) : (
                              <Pill tone="good">Complete</Pill>
                            )}
                            <span className="text-xs text-fg-muted">{s.counts.done}/{s.counts.total || "–"} analysed</span>
                            {s.topOpportunity != null && <TierBadge score={s.topOpportunity} className="ml-auto" />}
                          </div>
                          {running && (
                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                              <motion.div className="h-full bg-gradient-to-r from-violet to-cyan" animate={{ width: `${Math.max(4, pct)}%` }} />
                            </div>
                          )}
                          {s.status === "failed" && s.error && <p className="mt-2 line-clamp-2 text-xs text-rose/80">{s.error}</p>}
                        </Link>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </Reveal>
      </div>
    </main>
  );
}
