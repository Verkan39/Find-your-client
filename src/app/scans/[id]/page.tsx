"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, ArrowLeft, ArrowUpRight, Bot, Box, Building2, CircleDollarSign, Flame, Globe, LayoutGrid, List, RotateCw, Search, Target, TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import { Constellation, type StarPoint } from "@/components/three";
import { AnimatedNumber, Meter, Pill, Reveal, STAGE_LABEL, ScoreRing, Spinner, TierBadge, timeAgo } from "@/components/ui";
import { GROUPS } from "@/lib/categories";
import { formatMoney } from "@/lib/market";
import type { ActivityEvent, Business, Report, Scan, ScanCounts } from "@/lib/types";

type Lead = Omit<Business, "crawl" | "research" | "report" | "tags"> & {
  hasWebsite: boolean;
  tech: string[];
  report: (Pick<Report, "source" | "summary" | "scores" | "revenue" | "profile"> & {
    topService: Report["pitch"]["services"][number] | null;
    gapCount: number;
  }) | null;
};

interface ScanData { scan: Scan; counts: ScanCounts; businesses: Lead[]; events: ActivityEvent[] }

type SortKey = "opportunity" | "revenue" | "digitalMaturity" | "socialVisibility";

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ScanData | null>(null);
  const [missing, setMissing] = useState(false);
  const [sort, setSort] = useState<SortKey>("opportunity");
  const [group, setGroup] = useState<string>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const res = await fetch(`/api/scans/${id}`);
      if (res.status === 404) { setMissing(true); return; }
      const d = (await res.json()) as ScanData;
      if (!alive) return;
      setData(d);
      const running = !["done", "failed"].includes(d.scan.status) || d.counts.inProgress > 0;
      timer = setTimeout(load, running ? 2500 : 15000);
    };
    load().catch(() => {});
    return () => { alive = false; clearTimeout(timer); };
  }, [id]);

  const leads = useMemo(() => {
    if (!data) return [];
    const val = (b: Lead) =>
      sort === "revenue" ? b.report?.revenue.high ?? -1 : b.report?.scores[sort] ?? -1;
    return data.businesses
      .filter((b) => group === "all" || b.group === group)
      .filter((b) => !q || `${b.name} ${b.categoryLabel} ${b.address ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => val(b) - val(a));
  }, [data, sort, group, q]);

  const stars: StarPoint[] = useMemo(
    () =>
      (data?.businesses ?? [])
        .filter((b) => b.report)
        .map((b) => ({
          id: b.id, name: b.name, category: b.categoryLabel,
          opportunity: b.report!.scores.opportunity, maturity: b.report!.scores.digitalMaturity,
          visibility: b.report!.scores.socialVisibility, revenue: (b.report!.revenue.low + b.report!.revenue.high) / 2,
          budgetFit: b.report!.scores.budgetFit,
        })),
    // re-layout only when the set of scored businesses or their scores change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.businesses.map((b) => `${b.id}:${b.opportunity}`).join("|")],
  );

  if (missing) {
    return (
      <main className="mx-auto grid min-h-screen max-w-7xl place-items-center px-4">
        <div className="text-center">
          <p className="text-fg-muted">This scan doesn't exist (it may have been deleted).</p>
          <Link href="/dashboard" className="mt-4 inline-block text-violet hover:underline">Back to dashboard</Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 pt-28 sm:px-6">
        <div className="skeleton h-10 w-80 rounded-xl" />
        <div className="mt-8 grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
        <div className="skeleton mt-6 h-[420px] rounded-3xl" />
      </main>
    );
  }

  const { scan, counts, businesses, events } = data;
  const running = !["done", "failed"].includes(scan.status);
  const scored = businesses.filter((b) => b.report);
  const hot = scored.filter((b) => (b.report!.scores.opportunity ?? 0) >= 70).length;
  const avgOpp = scored.length ? Math.round(scored.reduce((s, b) => s + b.report!.scores.opportunity, 0) / scored.length) : 0;
  const pipeline = scored.reduce((s, b) => {
    const t = b.report!.topService;
    return s + (t ? ((t.priceLow + t.priceHigh) / 2) * (t.acceptanceProbability / 100) : 0);
  }, 0);
  const pct = counts.total ? ((counts.done + counts.failed) / counts.total) * 100 : scan.status === "discovering" ? 8 : 3;
  const groupsPresent = GROUPS.filter((g) => businesses.some((b) => b.group === g));

  return (
    <main className="relative mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top_right,rgba(63,215,242,0.12),transparent_55%),radial-gradient(ellipse_at_top_left,rgba(111,92,255,0.18),transparent_55%)]" />

      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"><ArrowLeft className="size-4" /> Dashboard</Link>

      {/* header */}
      <Reveal>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">{scan.label?.split(",")[0] ?? scan.query}</h1>
            <p className="mt-2 text-sm text-fg-muted">
              {scan.label ?? scan.query} · {(scan.radiusM / 1000).toFixed(1)} km radius · {scan.discovered ? `${scan.discovered} businesses found` : "searching…"} · started {timeAgo(scan.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {scan.status === "failed" ? <Pill tone="bad">Failed</Pill> : running ? <Pill tone="info"><Spinner className="size-2.5 border" /> {STAGE_LABEL[scan.status]}</Pill> : <Pill tone="good">Complete</Pill>}
            {scan.aiMode !== "off" && <Pill tone="default"><Bot className="size-3" /> {scan.aiMode === "deep" ? "Deep research" : "AI brief"}</Pill>}
          </div>
        </div>
      </Reveal>

      {scan.status === "failed" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/25">
          <span>{scan.error ?? "Scan failed."}</span>
          <button
            onClick={async () => { await fetch(`/api/scans/${id}`, { method: "POST" }); setData({ ...data, scan: { ...scan, status: "queued", error: null } }); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose/15 px-3 py-1 text-xs font-medium text-fg ring-1 ring-rose/30 hover:bg-rose/25"
          >
            <RotateCw className="size-3.5" /> Retry
          </button>
        </div>
      )}

      {/* progress */}
      {running && (
        <div className="mt-6 overflow-hidden rounded-full bg-white/[0.05]">
          <motion.div className="relative h-1.5 bg-gradient-to-r from-violet via-cyan to-lime" animate={{ width: `${Math.max(3, pct)}%` }} transition={{ ease: "easeOut" }}>
            <div className="absolute inset-0 animate-[shimmer_1.6s_linear_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)] bg-[length:200%_100%]" />
          </motion.div>
        </div>
      )}

      {/* stat tiles */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Building2, label: "Analysed", value: counts.done, suffix: `/ ${counts.total || "–"}`, c: "text-violet" },
          { icon: Flame, label: "Hot leads (70+)", value: hot, c: "text-lime" },
          { icon: Target, label: "Avg. opportunity", value: avgOpp, c: "text-cyan" },
          { icon: CircleDollarSign, label: "Weighted pipeline", value: pipeline, fmt: (n: number) => formatMoney(n, scan.currency), c: "text-amber", hint: "Sum of each lead's first offer × its acceptance probability" },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05}>
            <div className="glass rounded-2xl p-5" title={s.hint}>
              <div className="flex items-center gap-2 text-xs text-fg-muted"><s.icon className={clsx("size-4", s.c)} /> {s.label}</div>
              <div className="mt-3 font-display text-3xl font-semibold tabular-nums">
                <AnimatedNumber value={s.value} format={s.fmt} />
                {s.suffix && <span className="ml-1 text-base text-fg-faint">{s.suffix}</span>}
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* visual + activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <Reveal className="min-w-0">
          <div className="glass relative h-[460px] overflow-hidden rounded-3xl">
            <div className="absolute top-4 left-5 z-10">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold"><Box className="size-4 text-violet" /> Lead constellation</h2>
              <p className="mt-0.5 text-xs text-fg-faint">Drag to orbit · hover for details · click to open</p>
            </div>
            <div className="absolute top-4 right-4 z-10 flex gap-3 text-[11px] text-fg-muted">
              {[["#b6f36a", "Hot"], ["#ffb547", "Warm"], ["#8b93b8", "Cool"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: c }} />{l}</span>
              ))}
            </div>
            {stars.length ? (
              <Constellation points={stars} onSelect={(bid) => router.push(`/business/${bid}`)} />
            ) : (
              <div className="grid h-full place-items-center text-sm text-fg-muted">
                <div className="flex flex-col items-center gap-3"><Spinner className="size-6" /> Leads appear here as they're scored…</div>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <section className="glass flex h-[460px] flex-col overflow-hidden rounded-2xl">
            <h3 className="flex items-center gap-2 px-5 pt-5 pb-3 font-display text-[15px] font-semibold tracking-tight">
              <Activity className="size-4 text-violet" /> Live activity
            </h3>
            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 [mask-image:linear-gradient(black_85%,transparent)]">
              <AnimatePresence initial={false}>
                {events.map((e) => (
                  <motion.li key={e.id} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2.5 rounded-lg px-2 py-1.5 text-xs">
                    <span className={clsx("mt-1 size-1.5 shrink-0 rounded-full", { info: "bg-cyan/70", success: "bg-lime", warn: "bg-amber", error: "bg-rose" }[e.level])} />
                    <div className="min-w-0">
                      <p className="text-fg-muted">
                        {e.businessId ? <Link href={`/business/${e.businessId}`} className="hover:text-fg">{e.message}</Link> : e.message}
                      </p>
                      <p className="text-[10px] text-fg-faint">{timeAgo(e.ts)}</p>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        </Reveal>
      </div>

      {/* leads */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Leads <span className="text-fg-faint">{leads.length}</span></h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 ring-1 ring-white/10 focus-within:ring-violet/50">
              <Search className="size-4 text-fg-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-32 bg-transparent text-sm outline-none placeholder:text-fg-faint sm:w-44" />
            </label>
            <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-9 rounded-xl bg-white/[0.04] px-3 text-sm ring-1 ring-white/10 outline-none">
              <option value="all">All groups</option>
              {groupsPresent.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 rounded-xl bg-white/[0.04] px-3 text-sm ring-1 ring-white/10 outline-none">
              <option value="opportunity">Sort: Opportunity</option>
              <option value="revenue">Sort: Revenue</option>
              <option value="digitalMaturity">Sort: Digital maturity</option>
              <option value="socialVisibility">Sort: Visibility</option>
            </select>
            <div className="flex rounded-xl bg-white/[0.04] p-0.5 ring-1 ring-white/10">
              {([["cards", LayoutGrid], ["list", List]] as const).map(([v, I]) => (
                <button key={v} onClick={() => setView(v)} aria-label={v === "cards" ? "Card view" : "List view"} className={clsx("rounded-lg p-1.5", view === v ? "bg-white/10 text-fg" : "text-fg-faint")}><I className="size-4" /></button>
              ))}
            </div>
          </div>
        </div>

        <motion.ul layout className={clsx("mt-5 grid gap-4", view === "cards" ? "md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
          <AnimatePresence>
            {leads.map((b, i) => (
              <motion.li key={b.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i * 0.025, 0.4) }}>
                {view === "cards" ? <LeadCard b={b} currency={scan.currency} /> : <LeadRow b={b} currency={scan.currency} />}
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </section>
    </main>
  );
}

function StatusLine({ b }: { b: Lead }) {
  if (b.status === "done") return null;
  if (b.status === "failed") return <Pill tone="bad">Failed</Pill>;
  return <Pill tone="info"><Spinner className="size-2.5 border" /> {STAGE_LABEL[b.status]}</Pill>;
}

function LeadCard({ b, currency }: { b: Lead; currency: string }) {
  const r = b.report;
  return (
    <Link href={`/business/${b.id}`} className="group glass relative block h-full overflow-hidden rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.05] hover:shadow-[0_20px_60px_-20px] hover:shadow-violet/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display font-semibold">{b.name}</h3>
            <ArrowUpRight className="size-4 shrink-0 text-fg-faint opacity-0 transition group-hover:opacity-100" />
          </div>
          <p className="mt-0.5 truncate text-xs text-fg-faint">{b.categoryLabel}{b.address ? ` · ${b.address}` : ""}</p>
        </div>
        {r ? <ScoreRing value={r.scores.opportunity} size={52} label="Opportunity" /> : <div className="skeleton size-[52px] rounded-full" />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {r && <TierBadge score={r.scores.opportunity} />}
        <StatusLine b={b} />
        {r?.source === "ai" && <Pill tone="info"><Bot className="size-3" /> AI</Pill>}
        {!b.hasWebsite && <Pill tone="warn"><Globe className="size-3" /> No website</Pill>}
      </div>

      {r ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <Meter label="Digital maturity" value={r.scores.digitalMaturity} />
            <Meter label="Visibility" value={r.scores.socialVisibility} />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-xs ring-1 ring-white/[0.05]">
            <span className="flex items-center gap-1.5 text-fg-muted"><TrendingUp className="size-3.5 text-violet" /> Revenue</span>
            <span className="font-medium tabular-nums">{formatMoney(r.revenue.low, currency)} – {formatMoney(r.revenue.high, currency)}</span>
          </div>
          {r.topService && (
            <div className="mt-2 rounded-xl bg-lime/[0.05] px-3 py-2 text-xs ring-1 ring-lime/15">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-fg">{r.topService.name}</span>
                <span className="shrink-0 tabular-nums text-lime">{r.topService.acceptanceProbability}% yes</span>
              </div>
              <div className="mt-0.5 text-fg-muted">{formatMoney(r.topService.priceLow, currency)}–{formatMoney(r.topService.priceHigh, currency)}{r.topService.pricingModel === "monthly" ? "/mo" : ""} · {r.gapCount} gaps found</div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-2"><div className="skeleton h-3 rounded" /><div className="skeleton h-3 w-2/3 rounded" /><div className="skeleton h-10 rounded-xl" /></div>
      )}
    </Link>
  );
}

function LeadRow({ b, currency }: { b: Lead; currency: string }) {
  const r = b.report;
  return (
    <Link href={`/business/${b.id}`} className="glass flex items-center gap-4 rounded-xl px-4 py-3 transition hover:bg-white/[0.05]">
      {r ? <ScoreRing value={r.scores.opportunity} size={40} stroke={4} /> : <div className="skeleton size-10 rounded-full" />}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{b.name}</div>
        <div className="truncate text-xs text-fg-faint">{b.categoryLabel}{b.address ? ` · ${b.address}` : ""}</div>
      </div>
      <div className="hidden w-40 md:block">{r && <Meter label="Digital" value={r.scores.digitalMaturity} />}</div>
      <div className="hidden w-40 md:block">{r && <Meter label="Visibility" value={r.scores.socialVisibility} />}</div>
      <div className="hidden w-44 text-right text-xs tabular-nums text-fg-muted lg:block">{r && `${formatMoney(r.revenue.low, currency)} – ${formatMoney(r.revenue.high, currency)}`}</div>
      <div className="w-28 text-right"><StatusLine b={b} />{b.status === "done" && r && <TierBadge score={r.scores.opportunity} />}</div>
    </Link>
  );
}
