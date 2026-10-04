"use client";

import { api } from "@/lib/fetcher";
import Link from "next/link";
import { use, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Bot, Check, ChevronDown, CircleHelp, Clock, Copy, ExternalLink, Globe, Mail, MapPin,
  Minus, Phone, RefreshCw, Target, TrendingDown, TrendingUp, X,
} from "lucide-react";
import clsx from "clsx";
import { ScoreOrb } from "@/components/three";
import { Markdown } from "@/components/Markdown";
import { BusinessSkeleton } from "@/components/skeletons";
import { AnimatedNumber, Meter, Pill, Reveal, STAGE_LABEL, Spinner, TierBadge } from "@/components/ui";
import { bestOffer, deriveInsights, deriveVerdict, digitalChecklist, type CheckItem } from "@/lib/insights";
import { formatMoney } from "@/lib/market";
import { placesSourceName } from "@/lib/places";
import type { Business, KeyInsight, PeerStats, Report, Scan } from "@/lib/types";

const SERIES = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)", "var(--color-series-4)"];

interface Data { business: Business; scan: Scan; peers: PeerStats | null }

export default function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [rerun, setRerun] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const res = await api(`/api/businesses/${id}`);
      if (res.status === 404) { setMissing(true); return; }
      const d = await res.json();
      if (!alive) return;
      setData(d);
      timer = setTimeout(load, ["done", "failed"].includes(d.business.status) ? 30000 : 2500);
    };
    load().catch(() => {});
    return () => { alive = false; clearTimeout(timer); };
  }, [id, rerun]);

  async function reanalyze(fresh: boolean) {
    await api(`/api/businesses/${id}/reanalyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fresh }) });
    setRerun((r) => !r);
  }

  if (missing) return <main className="grid min-h-screen place-items-center text-fg-muted">Business not found.</main>;
  if (!data) return <BusinessSkeleton />;

  const { business: b, scan, peers } = data;
  const r = b.report;
  const working = !["done", "failed"].includes(b.status);

  return (
    <main className="relative mx-auto max-w-7xl px-4 pt-24 pb-28 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] bg-[radial-gradient(ellipse_at_80%_10%,rgba(111,92,255,0.2),transparent_50%),radial-gradient(ellipse_at_10%_30%,rgba(63,215,242,0.07),transparent_50%)]" />

      <Link href={`/scans/${b.scanId}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {scan.label?.split(",")[0] ?? "Scan"}
      </Link>

      <Header b={b} r={r} working={working} onRerun={reanalyze} />

      {!r ? (
        <div className="glass mt-10 grid place-items-center rounded-3xl py-24 text-fg-muted"><Spinner className="size-6" /><p className="mt-3">Analysing…</p></div>
      ) : (
        <Brief b={b} r={r} scan={scan} peers={peers} />
      )}
    </main>
  );
}

/* ================================ header ================================ */

function Header({ b, r, working, onRerun }: { b: Business; r: Report | null; working: boolean; onRerun: (fresh: boolean) => void }) {
  const verdict = r ? (r.verdict || deriveVerdict(r)) : null;
  return (
    <section className="mt-4 grid items-center gap-6 lg:grid-cols-[1fr_260px]">
      <Reveal>
        <div className="flex flex-wrap items-center gap-2">
          <Pill>{b.categoryLabel}</Pill>
          {r && <TierBadge score={r.scores.opportunity} />}
          {r?.source === "ai" ? <Pill tone="info"><Bot className="size-3" /> AI{b.research ? " + web research" : ""}</Pill> : r && <Pill>Engine analysis</Pill>}
          {working && <Pill tone="info"><Spinner className="size-2.5 border" /> {STAGE_LABEL[b.status]}</Pill>}
          {b.status === "failed" && <Pill tone="bad">Failed: {b.error}</Pill>}
        </div>

        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{b.name}</h1>

        {r && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted capitalize">
            <span>{r.profile.size}</span><Dot />
            <span className="normal-case">{r.profile.employeesEstimate}</span><Dot />
            <span>{r.profile.priceTier} pricing</span><Dot />
            <span>{r.profile.isChain ? "Chain" : "Independent"}</span>
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {b.website && <IconLink href={b.website} icon={<Globe className="size-4" />} label={hostOf(b.website)} />}
          {b.phone && <IconLink href={`tel:${b.phone.split(";")[0]}`} icon={<Phone className="size-4" />} label={b.phone.split(";")[0]} />}
          {b.email && <IconLink href={`mailto:${b.email}`} icon={<Mail className="size-4" />} label={b.email} />}
          <IconLink href={b.google?.mapsUrl ?? `https://www.openstreetmap.org/${b.osmId}`} icon={<MapPin className="size-4" />} label={b.address ? b.address.split(",")[0] : "Map"} />
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button disabled={working} onClick={() => onRerun(false)} title="Re-run analysis" className="grid size-8 place-items-center rounded-full bg-white/[0.05] text-fg-muted ring-1 ring-white/10 transition hover:text-fg disabled:opacity-40">
            <RefreshCw className={clsx("size-3.5", working && "animate-spin")} />
          </button>
          <button disabled={working} onClick={() => onRerun(true)} className="rounded-full px-3 py-1.5 text-xs text-fg-muted ring-1 ring-white/10 transition hover:text-fg disabled:opacity-40" title="Re-crawl the website and redo the web research">
            Fresh crawl
          </button>
        </div>

        {verdict && (
          <div className="relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-r from-violet/[0.14] via-cyan/[0.06] to-transparent py-4 pr-5 pl-5 ring-1 ring-white/10">
            <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-violet to-cyan" />
            <div className="flex items-start gap-3">
              <Target className="mt-1 size-5 shrink-0 text-violet" />
              <p className="font-display text-lg leading-snug font-medium sm:text-xl">{verdict}</p>
            </div>
          </div>
        )}
      </Reveal>

      <Reveal delay={0.1}>
        <div className="relative mx-auto aspect-square w-full max-w-[260px]">
          {r && <ScoreOrb score={r.scores.opportunity} />}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="font-display text-6xl font-semibold tabular-nums drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)]">{r ? <AnimatedNumber value={r.scores.opportunity} /> : "–"}</div>
              <div className="text-[11px] tracking-[0.2em] text-fg uppercase drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]">Opportunity</div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ================================ brief ================================ */

function Brief({ b, r, scan, peers }: { b: Business; r: Report; scan: Scan; peers: PeerStats | null }) {
  const money = (n: number) => formatMoney(n, r.revenue.currency);
  const best = bestOffer(r);
  const insights = r.keyInsights?.length ? r.keyInsights : deriveInsights(b, r, peers);
  const g = b.google;

  const kpis: { label: string; value: ReactNode; sub: string }[] = [
    { label: "Est. revenue", value: `${money(r.revenue.low)}–${money(r.revenue.high)}`, sub: `per year · ${r.revenue.confidence} confidence` },
    { label: "Deal size", value: best ? `${money(best.priceLow)}–${money(best.priceHigh)}` : "–", sub: best ? `${best.name}${best.pricingModel === "monthly" ? " /mo" : ""}` : "no offer" },
    { label: "Win chance", value: best ? <><AnimatedNumber value={best.acceptanceProbability} />%</> : "–", sub: "for the first offer" },
    { label: "Digital", value: <><AnimatedNumber value={r.scores.digitalMaturity} /><span className="text-base text-fg-faint">/100</span></>, sub: r.scores.digitalMaturity < 35 ? "far behind" : r.scores.digitalMaturity < 65 ? "room to improve" : "already strong" },
    { label: "Visibility", value: <><AnimatedNumber value={r.scores.socialVisibility} /><span className="text-base text-fg-faint">/100</span></>, sub: r.scores.socialVisibility < 35 ? "hard to find" : r.scores.socialVisibility < 65 ? "partly visible" : "easy to find" },
    g?.rating
      ? { label: "Rating", value: `${g.rating.toFixed(1)}★`, sub: `${g.reviewCount ?? 0} ${placesSourceName(g)} reviews` }
      : { label: "Reputation", value: <><AnimatedNumber value={r.scores.reputation} /><span className="text-base text-fg-faint">/100</span></>, sub: "unverified" },
  ];

  return (
    <>
      {/* ------------------------------ KPI strip ------------------------------ */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k, i) => (
          <Reveal key={k.label} delay={i * 0.04}>
            <div className="glass h-full rounded-2xl p-4">
              <div className="text-[11px] font-medium tracking-wide text-fg-faint uppercase">{k.label}</div>
              <div className="mt-2 font-display text-2xl leading-tight font-semibold tabular-nums">{k.value}</div>
              <div className="mt-1 truncate text-xs text-fg-muted" title={k.sub}>{k.sub}</div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* ----------------------------- key insights ----------------------------- */}
      <Section eyebrow="Key insights" title="What matters" className="mt-12">
        <div className={clsx("grid gap-3 sm:grid-cols-2", insights.length >= 5 ? "lg:grid-cols-5" : insights.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          {insights.map((ins, i) => <InsightCard key={i} ins={ins} delay={i * 0.05} />)}
        </div>
      </Section>

      {/* -------------------------------- pitch -------------------------------- */}
      <Section eyebrow="The pitch" title={r.pitch.headline} className="mt-14">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="min-w-0 space-y-3">
            {best && <BestOffer s={best} money={money} revenueMid={(r.revenue.low + r.revenue.high) / 2} />}
            <div className="glass rounded-2xl p-2">
              <div className="flex px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-fg-faint uppercase">
                <span className="flex-1">Other offers</span><span className="text-right sm:w-28">Price</span><span className="hidden w-32 pl-4 sm:block">Win chance</span><span className="w-5" />
              </div>
              {r.pitch.services.filter((s) => s !== best).map((s) => <OfferRow key={s.name} s={s} money={money} />)}
            </div>
          </div>
          <PitchKit r={r} />
        </div>
      </Section>

      {/* ---------------------------- business health ---------------------------- */}
      <Section eyebrow="Business health" title="At a glance" className="mt-14">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Reveal className="min-w-0 lg:row-span-3"><Checklist items={digitalChecklist(b)} score={r.scores.digitalMaturity} /></Reveal>

          <Reveal delay={0.05}>
            <Panel title="Scores">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Meter label="Opportunity" value={r.scores.opportunity} />
                <Meter label="Urgency" value={r.scores.urgency} hint="How much current gaps cost them" />
                <Meter label="Budget fit" value={r.scores.budgetFit} hint="Ability and willingness to pay" />
                <Meter label="Reputation" value={r.scores.reputation} />
                <Meter label="Digital" value={r.scores.digitalMaturity} />
                <Meter label="Visibility" value={r.scores.socialVisibility} />
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.1}>
            <Panel title="Revenue" aside={<Pill tone={r.revenue.confidence === "high" ? "good" : r.revenue.confidence === "medium" ? "info" : "warn"}>{r.revenue.confidence}</Pill>}>
              <div className="font-display text-3xl font-semibold tabular-nums">{money(r.revenue.low)}<span className="text-fg-faint"> – </span>{money(r.revenue.high)}</div>
              <div className="text-xs text-fg-faint">estimated per year</div>
              <div className="mt-3 flex flex-wrap gap-1.5">{r.revenue.drivers.slice(0, 4).map((d) => <Pill key={d}>{d}</Pill>)}</div>
              <Expand label="How we estimated this"><p className="text-sm text-fg-muted">{r.revenue.reasoning}</p></Expand>
            </Panel>
          </Reveal>

          <Reveal delay={0.05}><Customers r={r} /></Reveal>

          <Reveal delay={0.1}>
            <Panel title="Social presence">
              <div className="grid grid-cols-2 gap-2">
                {r.social.channels.slice(0, 6).map((c) => {
                  const tone = c.status === "strong" ? "good" : c.status === "active" ? "info" : c.status === "weak" ? "warn" : c.status === "missing" ? "bad" : "default";
                  const body = (
                    <div className="h-full rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/5 transition hover:bg-white/[0.06]" title={c.detail}>
                      <div className="truncate text-sm">{c.platform}</div>
                      <Pill tone={tone} className="mt-1.5">{c.status}</Pill>
                    </div>
                  );
                  return c.url ? <a key={c.platform} href={c.url} target="_blank" rel="noreferrer">{body}</a> : <div key={c.platform}>{body}</div>;
                })}
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.05}>
            <Panel title="Competition">
              {peers && peers.total > 0 ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-semibold tabular-nums">{peers.withWebsite}<span className="text-fg-faint">/{peers.total}</span></span>
                    <span className="text-sm text-fg-muted">nearby rivals have a website</span>
                  </div>
                  <div className="mt-3 flex gap-1">
                    {Array.from({ length: Math.min(peers.total, 20) }, (_, i) => (
                      <span key={i} className={clsx("h-2 flex-1 rounded-full", i < peers.withWebsite ? "bg-cyan/70" : "bg-white/[0.08]")} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-fg-muted">No same-category rivals in this scan.</p>
              )}
              {r.competition.notable.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{r.competition.notable.slice(0, 4).map((n) => <Pill key={n}>{n}</Pill>)}</div>}
            </Panel>
          </Reveal>

          <Reveal delay={0.1}>
            <Panel title="Gaps & risks">
              <ul className="space-y-1.5">
                {r.audit.gaps.slice(0, 5).map((gap) => (
                  <li key={gap.issue} className="flex items-center justify-between gap-2 text-sm" title={gap.evidence}>
                    <span className="truncate">{gap.issue}</span>
                    <Pill tone={gap.impact === "high" ? "bad" : gap.impact === "medium" ? "warn" : "default"}>{gap.impact}</Pill>
                  </li>
                ))}
              </ul>
              {r.risks.length > 0 && (
                <Expand label={`${r.risks.length} risk${r.risks.length > 1 ? "s" : ""} to watch`}>
                  <ul className="space-y-1.5">{r.risks.map((x) => <li key={x} className="flex gap-2 text-sm text-fg-muted"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />{x}</li>)}</ul>
                </Expand>
              )}
            </Panel>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------- evidence ------------------------------- */}
      <Section eyebrow="Evidence" title="Sources & raw data" className="mt-14">
        <div className="space-y-3">
          <Disclosure title="Web research" meta={b.research ? `${b.research.searches} searches · ${b.research.sources.length} sources` : scan.aiMode === "deep" ? "not run yet" : "not enabled for this scan"}>
            {b.research ? (
              <>
                <Markdown text={b.research.notes} />
                {b.research.sources.length > 0 && (
                  <ul className="mt-4 grid gap-1.5 border-t border-white/5 pt-4 sm:grid-cols-2">
                    {b.research.sources.map((s) => (
                      <li key={s.url} className="min-w-0"><a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate text-xs text-cyan/80 hover:text-cyan"><ExternalLink className="size-3 shrink-0" /><span className="truncate">{s.title || hostOf(s.url)}</span></a></li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-fg-muted">Run a scan with Deep research (set up an AI provider on your <a href="/profile#keys" className="text-violet hover:underline">Profile</a>) for reviews, follower counts, competitors and owner details from the web.</p>
            )}
          </Disclosure>
          <Disclosure title="Website crawl" meta={b.crawl?.ok ? `${b.crawl.pagesCrawled.length} pages · ${b.crawl.tech.slice(0, 3).join(", ") || "custom stack"}` : b.website ? "unreachable" : "no website"}>
            <CrawlTable b={b} />
          </Disclosure>
          <Disclosure title={`${g ? placesSourceName(g) : "Customer"} reviews`} meta={g?.reviews.length ? `${g.reviews.length} recent` : "not available"}>
            {g?.reviews.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {g.reviews.map((rv, i) => (
                  <blockquote key={i} className="rounded-xl bg-white/[0.03] p-3 text-sm text-fg-muted ring-1 ring-white/5">
                    <span className="text-amber">{"★".repeat(Math.round(rv.rating))}</span>{rv.when && <span className="ml-2 text-xs text-fg-faint">{rv.when}</span>}
                    <p className="mt-1">{rv.text}</p>
                  </blockquote>
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Add a Google Places or Yelp key on your <a href="/profile#keys" className="text-violet hover:underline">Profile</a> for ratings, review volume and review text.</p>
            )}
          </Disclosure>
          <Disclosure title="Full written summary" meta="for reading later">
            <p className="text-sm leading-relaxed text-fg-muted">{r.summary}</p>
            <p className="mt-3 text-sm text-fg-muted"><span className="text-fg">Customer journey:</span> {r.customers.journey}</p>
            <p className="mt-3 text-sm text-fg-muted"><span className="text-fg">Competition:</span> {r.competition.landscape}</p>
          </Disclosure>
        </div>
      </Section>
    </>
  );
}

/* ============================== building blocks ============================== */

function Section({ eyebrow, title, children, className }: { eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <Reveal>
        <p className="text-xs font-medium tracking-[0.18em] text-violet uppercase">{eyebrow}</p>
        <h2 className="mt-1.5 mb-5 max-w-4xl font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      </Reveal>
      {children}
    </section>
  );
}

function Panel({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("glass h-full rounded-2xl p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium tracking-wide text-fg-faint uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </div>
  );
}

const TONE = {
  positive: { color: "var(--color-lime)", Icon: TrendingUp, word: "Strength" },
  negative: { color: "var(--color-rose)", Icon: TrendingDown, word: "Gap" },
  neutral: { color: "var(--color-cyan)", Icon: Minus, word: "Context" },
} as const;

function InsightCard({ ins, delay }: { ins: KeyInsight; delay: number }) {
  const t = TONE[ins.tone] ?? TONE.neutral;
  return (
    <Reveal delay={delay} className="h-full">
      <div className="glass group relative h-full overflow-hidden rounded-2xl p-4">
        <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: t.color, opacity: 0.7 }} />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-wide text-fg-faint uppercase">{ins.label}</span>
          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: t.color }}><t.Icon className="size-3" />{t.word}</span>
        </div>
        <div className="mt-2 font-display text-3xl font-semibold tracking-tight">{ins.stat}</div>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{ins.detail}</p>
      </div>
    </Reveal>
  );
}

type Service = Report["pitch"]["services"][number];

function BestOffer({ s, money, revenueMid }: { s: Service; money: (n: number) => string; revenueMid: number }) {
  const r = 30;
  const share = ((s.priceHigh * (s.pricingModel === "monthly" ? 12 : 1)) / revenueMid) * 100;
  const c = 2 * Math.PI * r;
  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-lime/[0.10] via-lime/[0.03] to-transparent p-5 ring-1 ring-lime/25">
        <div className="absolute -top-16 -right-16 size-48 rounded-full bg-lime/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-lime"><BadgeCheck className="size-4" /> Most likely yes</div>
            <h3 className="mt-1.5 font-display text-2xl font-semibold">{s.name}</h3>
            <div className="mt-1 font-display text-xl font-semibold tabular-nums text-fg">{money(s.priceLow)}–{money(s.priceHigh)}<span className="text-sm font-normal text-fg-muted">{s.pricingModel === "monthly" ? " /month" : s.pricingModel === "retainer" ? " retainer" : " one-time"}</span></div>
          </div>
          <div className="relative grid size-[76px] shrink-0 place-items-center" aria-label={`${s.acceptanceProbability}% win chance`}>
            <svg width="76" height="76" className="-rotate-90">
              <circle cx="38" cy="38" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="6" />
              <motion.circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-lime)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c}
                initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - s.acceptanceProbability / 100) }} viewport={{ once: true }} transition={{ duration: 1.1 }} />
            </svg>
            <div className="absolute text-center leading-none"><div className="font-display text-lg font-semibold">{s.acceptanceProbability}%</div><div className="mt-0.5 text-[9px] text-fg-muted uppercase">win</div></div>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { k: "Effort", v: `~${s.effortDays}d` },
            { k: "Model", v: s.pricingModel },
            { k: "Of revenue", v: share < 1 ? "<1%" : `${share.toFixed(1)}%` },
          ].map((x) => (
            <div key={x.k} className="rounded-xl bg-black/20 px-2 py-2 ring-1 ring-white/5">
              <div className="text-[10px] text-fg-faint uppercase">{x.k}</div>
              <div className="mt-0.5 truncate text-sm font-medium capitalize" title={x.v}>{x.v}</div>
            </div>
          ))}
        </div>
        <Expand label="Why it works">
          <div className="space-y-2 text-sm text-fg-muted">
            <p><span className="text-fg">Problem:</span> {s.whyTheyNeedIt}</p>
            <p><span className="text-fg">Impact:</span> {s.expectedImpact}</p>
          </div>
        </Expand>
      </div>
    </Reveal>
  );
}

function OfferRow({ s, money }: { s: Service; money: (n: number) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl transition hover:bg-white/[0.03]">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
        <span className="shrink-0 text-right text-sm tabular-nums text-fg-muted sm:w-28">{money(s.priceLow)}–{money(s.priceHigh)}{s.pricingModel === "monthly" ? "/mo" : ""}</span>
        <span className="hidden w-32 items-center gap-2 pl-4 sm:flex">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full bg-gradient-to-r from-violet to-cyan" style={{ width: `${s.acceptanceProbability}%` }} /></span>
          <span className="w-8 text-right text-xs tabular-nums">{s.acceptanceProbability}%</span>
        </span>
        <ChevronDown className={clsx("size-4 shrink-0 text-fg-faint transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-1.5 px-3 pb-3 text-xs text-fg-muted">
              <p className="sm:hidden">Win chance: <span className="text-fg">{s.acceptanceProbability}%</span></p>
              <p><span className="text-fg">Problem:</span> {s.whyTheyNeedIt}</p>
              <p><span className="text-fg">Impact:</span> {s.expectedImpact}</p>
              <p><span className="text-fg">Effort:</span> ~{s.effortDays} days · {s.pricingModel}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TABS = ["Message", "Talking points", "Objections", "Approach"] as const;

function PitchKit({ r }: { r: Report }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Message");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${r.pitch.outreach.subject}\n\n${r.pitch.outreach.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Reveal delay={0.05} className="h-full min-w-0">
      <div className="glass flex h-full flex-col rounded-2xl p-2">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-black/20 p-1" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("relative flex-1 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition", tab === t ? "text-fg" : "text-fg-muted hover:text-fg")}>
              {tab === t && <motion.span layoutId="pitch-tab" className="absolute inset-0 rounded-lg bg-white/[0.08] ring-1 ring-white/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{t}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 p-3">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              {tab === "Message" && (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-sm"><span className="text-fg-faint">Subject: </span>{r.pitch.outreach.subject}</div>
                    <button onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-fg px-3 py-1 text-xs font-medium text-ink-950 transition hover:bg-white">
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-3 max-h-72 overflow-y-auto rounded-xl bg-black/20 p-3 text-sm leading-relaxed whitespace-pre-line text-fg-muted ring-1 ring-white/5">{r.pitch.outreach.body}</p>
                </div>
              )}
              {tab === "Talking points" && (
                <ol className="space-y-2.5">
                  {r.pitch.talkingPoints.map((t, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-violet/15 text-[11px] font-medium text-violet">{i + 1}</span>
                      <span className="text-fg-muted">{t}</span>
                    </li>
                  ))}
                </ol>
              )}
              {tab === "Objections" && (
                <div className="space-y-1.5">{r.pitch.objections.map((o, i) => <Objection key={i} {...o} />)}</div>
              )}
              {tab === "Approach" && (
                <dl className="grid gap-2">
                  {[
                    { k: "Who decides", v: r.pitch.decisionMaker, Icon: Target },
                    { k: "Best channel", v: r.pitch.bestChannel, Icon: Mail },
                    { k: "Best time", v: r.pitch.bestTiming, Icon: Clock },
                    { k: "Angle", v: r.pitch.angle, Icon: BadgeCheck },
                  ].map(({ k, v, Icon }) => (
                    <div key={k} className="flex gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                      <Icon className="mt-0.5 size-4 shrink-0 text-violet" />
                      <div><dt className="text-[11px] text-fg-faint uppercase">{k}</dt><dd className="mt-0.5 text-sm">{v}</dd></div>
                    </div>
                  ))}
                </dl>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Reveal>
  );
}

function Objection({ objection, response }: { objection: string; response: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm" aria-expanded={open}>
        <span className="flex items-center gap-2"><CircleHelp className="size-4 shrink-0 text-amber" />“{objection}”</span>
        <ChevronDown className={clsx("size-4 shrink-0 text-fg-faint transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-3 pb-3 pl-9 text-sm text-fg-muted">
            {response}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Checklist({ items, score }: { items: CheckItem[]; score: number }) {
  const passed = items.filter((i) => i.state === "pass").length;
  return (
    <Panel title="Website checklist" aside={<span className="text-xs tabular-nums text-fg-muted"><span className="font-display text-base font-semibold text-fg">{passed}</span>/{items.length} passed</span>}>
      <div className="mb-4 flex gap-1">
        {items.map((i) => (
          <span key={i.key} className={clsx("h-1.5 flex-1 rounded-full", i.state === "pass" ? "bg-lime/80" : i.state === "fail" ? "bg-rose/70" : "bg-white/10")} />
        ))}
      </div>
      {items.some((i) => i.state === "unknown") && items[0].state === "fail" && (
        <p className="mb-3 rounded-lg bg-rose/[0.07] px-3 py-2 text-xs text-rose/90 ring-1 ring-rose/15">{items[0].note}. The other checks need a working site.</p>
      )}
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm" title={i.note}>
            <span className={clsx("grid size-5 shrink-0 place-items-center rounded-full", i.state === "pass" ? "bg-lime/15 text-lime" : i.state === "fail" ? "bg-rose/15 text-rose" : "bg-white/5 text-fg-faint")}>
              {i.state === "pass" ? <Check className="size-3" strokeWidth={3} /> : i.state === "fail" ? <X className="size-3" strokeWidth={3} /> : <Minus className="size-3" />}
            </span>
            <span className={clsx("flex-1", i.state === "unknown" && "text-fg-faint")}>{i.label}</span>
            <span className="max-w-[45%] truncate text-xs text-fg-faint">{i.note || "–"}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-fg-muted">
        <span>Digital maturity</span><span className="font-display text-base font-semibold text-fg tabular-nums">{score}/100</span>
      </div>
    </Panel>
  );
}

function Customers({ r }: { r: Report }) {
  const segs = r.customers.segments.slice(0, 4);
  return (
    <Panel title="Customer mix">
      <div className="text-sm">Main: <span className="font-medium">{r.customers.primary}</span></div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label={segs.map((s) => `${s.name} ${s.share}%`).join(", ")}>
        {segs.map((s, i) => (
          <motion.span key={s.name} title={`${s.name}: ${s.share}%`} className="h-full border-r-2 border-ink-800 last:border-0" style={{ background: SERIES[i] }}
            initial={{ width: 0 }} whileInView={{ width: `${s.share}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.08 }} />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {segs.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2.5 text-sm" title={s.description}>
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: SERIES[i] }} />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="font-medium tabular-nums">{s.share}%</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Expand({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mt-3">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs text-fg-faint transition hover:text-fg">
        {label}<ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Disclosure({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-2xl">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="font-medium">{title}</span>
        <span className="flex items-center gap-3 text-xs text-fg-faint"><span className="hidden sm:inline">{meta}</span><ChevronDown className={clsx("size-4 transition-transform", open && "rotate-180")} /></span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto border-t border-white/5 px-5 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CrawlTable({ b }: { b: Business }) {
  const c = b.crawl;
  if (!b.website) return <p className="text-sm text-fg-muted">No website found for this business.</p>;
  if (!c) return <p className="text-sm text-fg-muted">Not crawled yet.</p>;
  if (!c.ok) return <p className="text-sm text-rose">{c.error ?? "Unreachable"}</p>;
  const list = (a: string[]) => (a.length ? a.join(", ") : "–");
  const rows: [string, string][] = [
    ["Pages crawled", c.pagesCrawled.map((p) => new URL(p).pathname).join("  ")],
    ["Response time", c.loadMs ? `${(c.loadMs / 1000).toFixed(2)}s` : "–"],
    ["Tech stack", list(c.tech)],
    ["Analytics", list(c.analytics)],
    ["Booking / ordering", list(c.booking)],
    ["E-commerce", list(c.ecommerce)],
    ["Chat", list(c.chat)],
    ["Schema.org", list(c.jsonLdTypes)],
    ["Emails found", list(c.emails)],
    ["Words", c.wordCount.toLocaleString()],
  ];
  return (
    <dl className="grid gap-x-8 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-white/5 py-2 text-sm">
          <dt className="shrink-0 text-fg-faint">{k}</dt><dd className="truncate text-right text-fg-muted" title={v}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function IconLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const external = href.startsWith("http");
  return (
    <a href={href} target={external ? "_blank" : undefined} rel="noreferrer" title={label} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-fg-muted ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-fg">
      <span className="text-violet">{icon}</span><span className="truncate">{label}</span>
    </a>
  );
}

function Dot() {
  return <span className="size-1 rounded-full bg-white/20" />;
}

function hostOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}
