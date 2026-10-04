"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Bot, Check, CheckCircle2, ChevronDown, Clock, Code2, Copy, ExternalLink, Gauge,
  Globe, Lightbulb, Mail, MapPin, MessageSquareQuote, Phone, RefreshCw, Shield, Swords, Target, TrendingUp, UserRound, Users,
} from "lucide-react";
import clsx from "clsx";
import { ScoreOrb } from "@/components/three";
import { Markdown } from "@/components/Markdown";
import { Card, Meter, Pill, Reveal, STAGE_LABEL, Spinner, TierBadge, TiltCard } from "@/components/ui";
import { formatMoney } from "@/lib/market";
import type { Business, Report, Scan } from "@/lib/types";

const SERIES = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)", "var(--color-series-4)"];

export default function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ business: Business; scan: Scan } | null>(null);
  const [missing, setMissing] = useState(false);
  const [rerun, setRerun] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const res = await fetch(`/api/businesses/${id}`);
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
    await fetch(`/api/businesses/${id}/reanalyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fresh }) });
    setRerun((r) => !r);
  }

  if (missing) return <main className="grid min-h-screen place-items-center text-fg-muted">Business not found.</main>;
  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 pt-28 sm:px-6">
        <div className="skeleton h-12 w-96 rounded-xl" />
        <div className="mt-8 grid gap-6 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}</div>
      </main>
    );
  }

  const { business: b, scan } = data;
  const r = b.report;
  const cur = r?.revenue.currency ?? scan.currency;
  const money = (n: number) => formatMoney(n, cur);
  const working = !["done", "failed"].includes(b.status);

  return (
    <main className="relative mx-auto max-w-7xl px-4 pt-24 pb-28 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] bg-[radial-gradient(ellipse_at_80%_10%,rgba(111,92,255,0.22),transparent_50%),radial-gradient(ellipse_at_10%_30%,rgba(63,215,242,0.08),transparent_50%)]" />

      <Link href={`/scans/${b.scanId}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {scan.label?.split(",")[0] ?? "Scan"}
      </Link>

      {/* ------------------------------- hero ------------------------------- */}
      <section className="mt-4 grid items-center gap-6 lg:grid-cols-[1fr_320px]">
        <Reveal>
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{b.group}</Pill>
            <Pill>{b.categoryLabel}</Pill>
            {r && <TierBadge score={r.scores.opportunity} />}
            {r?.source === "ai" ? <Pill tone="info"><Bot className="size-3" /> AI analysis{b.research ? " + web research" : ""}</Pill> : r && <Pill tone="default">Engine analysis</Pill>}
            {working && <Pill tone="info"><Spinner className="size-2.5 border" /> {STAGE_LABEL[b.status]}</Pill>}
            {b.status === "failed" && <Pill tone="bad">Failed: {b.error}</Pill>}
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-6xl">{b.name}</h1>
          {r && <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-fg-muted">{r.summary}</p>}

          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {b.website && <ContactLink href={b.website} icon={<Globe className="size-4" />} label={hostOf(b.website)} />}
            {b.phone && <ContactLink href={`tel:${b.phone}`} icon={<Phone className="size-4" />} label={b.phone} />}
            {b.email && <ContactLink href={`mailto:${b.email}`} icon={<Mail className="size-4" />} label={b.email} />}
            <ContactLink href={b.google?.mapsUrl ?? `https://www.openstreetmap.org/${b.osmId}`} icon={<MapPin className="size-4" />} label={b.address ?? "View on map"} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button disabled={working} onClick={() => reanalyze(false)} className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40">
              <RefreshCw className={clsx("size-4", working && "animate-spin")} /> Re-run analysis
            </button>
            <button disabled={working} onClick={() => reanalyze(true)} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-fg-muted ring-1 ring-white/10 transition hover:text-fg disabled:opacity-40" title="Re-crawl the website and redo web research from scratch">
              Fresh crawl + research
            </button>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative mx-auto aspect-square w-full max-w-[320px]">
            {r && <ScoreOrb score={r.scores.opportunity} />}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="font-display text-6xl font-semibold tabular-nums drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)]">{r?.scores.opportunity ?? "–"}</div>
                <div className="text-xs tracking-widest text-fg uppercase drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]">Opportunity</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {!r ? (
        <div className="mt-12 glass grid place-items-center rounded-3xl py-24 text-fg-muted"><Spinner className="size-6" /><p className="mt-3">Analysing…</p></div>
      ) : (
        <>
          {/* ------------------------------ scores ------------------------------ */}
          <Reveal>
            <div className="glass mt-10 grid grid-cols-2 gap-x-8 gap-y-5 rounded-2xl p-6 sm:grid-cols-3 lg:grid-cols-6">
              <Meter label="Opportunity" value={r.scores.opportunity} />
              <Meter label="Urgency" value={r.scores.urgency} hint="How much current gaps cost them" />
              <Meter label="Budget fit" value={r.scores.budgetFit} hint="Ability and willingness to pay" />
              <Meter label="Digital maturity" value={r.scores.digitalMaturity} />
              <Meter label="Social visibility" value={r.scores.socialVisibility} />
              <Meter label="Reputation" value={r.scores.reputation} />
            </div>
          </Reveal>

          {/* ------------------------------ PITCH ------------------------------ */}
          <section className="mt-14">
            <Reveal>
              <p className="text-sm font-medium tracking-wide text-lime uppercase">What to pitch</p>
              <h2 className="mt-2 max-w-4xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">{r.pitch.headline}</h2>
              <p className="mt-3 max-w-3xl text-fg-muted">{r.pitch.angle}</p>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="relative mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-lime/[0.09] via-lime/[0.03] to-transparent p-6 ring-1 ring-lime/25">
                <div className="absolute -top-16 -right-16 size-48 rounded-full bg-lime/10 blur-3xl" />
                <div className="relative flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/15 ring-1 ring-lime/30"><BadgeCheck className="size-5 text-lime" /></span>
                  <div>
                    <div className="text-sm font-medium text-lime">What they'll most likely agree to</div>
                    <p className="mt-1 text-[15px] leading-relaxed">{r.pitch.willAgreeOn}</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {r.pitch.services.map((s, i) => (
                <Reveal key={s.name} delay={i * 0.06}>
                  <TiltCard className="h-full rounded-2xl" intensity={4}>
                    <div className="glass relative h-full rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-medium text-fg-faint">#{i + 1}{i === 0 ? " · lead with this" : ""}</div>
                          <h3 className="mt-0.5 font-display text-lg font-semibold">{s.name}</h3>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-lg font-semibold tabular-nums">{money(s.priceLow)}–{money(s.priceHigh)}</div>
                          <div className="text-[11px] text-fg-faint">{s.pricingModel} · ~{s.effortDays} days</div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-fg-muted">{s.description}</p>
                      <div className="mt-4 space-y-2 text-sm">
                        <p className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" /><span className="text-fg-muted"><span className="text-fg">Why:</span> {s.whyTheyNeedIt}</span></p>
                        <p className="flex gap-2"><TrendingUp className="mt-0.5 size-4 shrink-0 text-cyan" /><span className="text-fg-muted"><span className="text-fg">Impact:</span> {s.expectedImpact}</span></p>
                      </div>
                      <div className="mt-5">
                        <div className="mb-1.5 flex justify-between text-xs"><span className="text-fg-muted">Acceptance probability</span><span className="font-medium tabular-nums">{s.acceptanceProbability}%</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-violet via-cyan to-lime" initial={{ width: 0 }} whileInView={{ width: `${s.acceptanceProbability}%` }} viewport={{ once: true }} transition={{ duration: 1.1, delay: 0.1 }} />
                        </div>
                      </div>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <Reveal>
                <Outreach subject={r.pitch.outreach.subject} body={r.pitch.outreach.body} />
              </Reveal>
              <Reveal delay={0.05}>
                <Card title="Approach" icon={<UserRound className="size-4" />} className="h-full">
                  <dl className="space-y-4 text-sm">
                    <div><dt className="flex items-center gap-1.5 text-xs text-fg-faint"><UserRound className="size-3.5" /> Decision maker</dt><dd className="mt-1">{r.pitch.decisionMaker}</dd></div>
                    <div><dt className="flex items-center gap-1.5 text-xs text-fg-faint"><MessageSquareQuote className="size-3.5" /> Best channel</dt><dd className="mt-1">{r.pitch.bestChannel}</dd></div>
                    <div><dt className="flex items-center gap-1.5 text-xs text-fg-faint"><Clock className="size-3.5" /> Best timing</dt><dd className="mt-1">{r.pitch.bestTiming}</dd></div>
                  </dl>
                </Card>
              </Reveal>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Reveal>
                <Card title="Talking points" icon={<Lightbulb className="size-4" />} className="h-full">
                  <ol className="space-y-3">
                    {r.pitch.talkingPoints.map((t, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet/15 text-xs font-medium text-violet">{i + 1}</span>
                        <span className="text-fg-muted">{t}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
              </Reveal>
              <Reveal delay={0.05}>
                <Card title="Handling objections" icon={<Shield className="size-4" />} className="h-full">
                  <div className="space-y-2">
                    {r.pitch.objections.map((o, i) => <Objection key={i} {...o} defaultOpen={i === 0} />)}
                  </div>
                </Card>
              </Reveal>
            </div>
          </section>

          {/* ----------------------------- INSIGHTS ----------------------------- */}
          <section className="mt-16">
            <Reveal>
              <p className="text-sm font-medium tracking-wide text-violet uppercase">Business insights</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">Know them before you walk in.</h2>
            </Reveal>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <Reveal className="lg:col-span-2">
                <Card title="Revenue estimate" icon={<TrendingUp className="size-4" />} action={<Pill tone={r.revenue.confidence === "high" ? "good" : r.revenue.confidence === "medium" ? "info" : "warn"}>{r.revenue.confidence} confidence</Pill>} className="h-full">
                  <div className="font-display text-4xl font-semibold tabular-nums">{money(r.revenue.low)} <span className="text-fg-faint">–</span> {money(r.revenue.high)}</div>
                  <div className="text-xs text-fg-faint">estimated annual revenue</div>
                  <p className="mt-4 text-sm leading-relaxed text-fg-muted">{r.revenue.reasoning}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">{r.revenue.drivers.map((d) => <Pill key={d}>{d}</Pill>)}</div>
                </Card>
              </Reveal>
              <Reveal delay={0.05}>
                <Card title="Profile" icon={<Gauge className="size-4" />} className="h-full">
                  <p className="text-sm text-fg-muted">{r.profile.whatTheyDo}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Fact k="Size" v={r.profile.size} />
                    <Fact k="Team" v={r.profile.employeesEstimate} />
                    <Fact k="Price tier" v={r.profile.priceTier} />
                    <Fact k="Chain" v={r.profile.isChain ? "Yes" : "Independent"} />
                  </dl>
                </Card>
              </Reveal>

              <Reveal className="lg:col-span-2">
                <Card title="Target customers" icon={<Users className="size-4" />} className="h-full">
                  <p className="text-sm">Primary: <span className="font-medium">{r.customers.primary}</span></p>
                  <div className="mt-4 flex h-3 overflow-hidden rounded-full" role="img" aria-label={r.customers.segments.map((s) => `${s.name} ${s.share}%`).join(", ")}>
                    {r.customers.segments.slice(0, 4).map((s, i) => (
                      <motion.span key={s.name} title={`${s.name}: ${s.share}%`} className="h-full border-r-2 border-ink-800 last:border-0 first:rounded-l-full last:rounded-r-full" style={{ background: SERIES[i] }} initial={{ width: 0 }} whileInView={{ width: `${s.share}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.08 }} />
                    ))}
                  </div>
                  <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                    {r.customers.segments.slice(0, 4).map((s, i) => (
                      <li key={s.name} className="flex gap-3">
                        <span className="mt-1.5 size-2.5 shrink-0 rounded-sm" style={{ background: SERIES[i] }} />
                        <div>
                          <div className="text-sm font-medium">{s.name} <span className="font-normal text-fg-muted tabular-nums">· {s.share}%</span></div>
                          <div className="text-xs text-fg-muted">{s.description}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 rounded-xl bg-white/[0.03] p-3 text-sm text-fg-muted ring-1 ring-white/5"><span className="text-fg">Customer journey:</span> {r.customers.journey}</p>
                </Card>
              </Reveal>

              <Reveal delay={0.05}>
                <Card title="Social visibility" icon={<Globe className="size-4" />} className="h-full">
                  <p className="mb-4 text-sm text-fg-muted">{r.social.summary}</p>
                  <ul className="space-y-2.5">
                    {r.social.channels.map((c) => (
                      <li key={c.platform} className="flex items-start justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium">{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-cyan">{c.platform}</a> : c.platform}</div>
                          <div className="text-xs text-fg-faint">{c.detail}</div>
                        </div>
                        <Pill tone={c.status === "strong" ? "good" : c.status === "active" ? "info" : c.status === "weak" ? "warn" : c.status === "missing" ? "bad" : "default"}>{c.status}</Pill>
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>

              <Reveal className="lg:col-span-2">
                <Card title="Digital audit" icon={<Code2 className="size-4" />} className="h-full">
                  <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
                    <div>
                      <div className="mb-2 text-xs font-medium text-fg-faint">Strengths</div>
                      {r.audit.strengths.length ? (
                        <ul className="space-y-2">{r.audit.strengths.map((s) => <li key={s} className="flex gap-2 text-sm text-fg-muted"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime" />{s}</li>)}</ul>
                      ) : <p className="text-sm text-fg-faint">Nothing notable.</p>}
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-medium text-fg-faint">Gaps you can fix</div>
                      <ul className="space-y-3">
                        {r.audit.gaps.map((g) => (
                          <li key={g.issue} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{g.issue}</span>
                              <Pill tone={g.impact === "high" ? "bad" : g.impact === "medium" ? "warn" : "default"}>{g.impact} impact</Pill>
                            </div>
                            <p className="mt-1 text-xs text-fg-muted">{g.evidence}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              </Reveal>

              <Reveal delay={0.05}>
                <div className="flex h-full flex-col gap-6">
                  <Card title="Competition" icon={<Swords className="size-4" />}>
                    <p className="text-sm text-fg-muted">{r.competition.landscape}</p>
                    {r.competition.notable.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{r.competition.notable.map((n) => <Pill key={n}>{n}</Pill>)}</div>}
                  </Card>
                  {r.risks.length > 0 && (
                    <Card title="Watch out" icon={<AlertTriangle className="size-4" />} className="flex-1">
                      <ul className="space-y-2">{r.risks.map((x) => <li key={x} className="flex gap-2 text-sm text-fg-muted"><span className="mt-2 size-1 shrink-0 rounded-full bg-amber" />{x}</li>)}</ul>
                    </Card>
                  )}
                </div>
              </Reveal>
            </div>
          </section>

          {/* ------------------------------ evidence ------------------------------ */}
          <section className="mt-16 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Reveal>
              <Card title="Web research" icon={<Bot className="size-4" />} className="h-full">
                {b.research ? (
                  <>
                    <div className="max-h-[560px] overflow-y-auto pr-2"><Markdown text={b.research.notes} /></div>
                    {b.research.sources.length > 0 && (
                      <div className="mt-5 border-t border-white/5 pt-4">
                        <div className="mb-2 text-xs font-medium text-fg-faint">Sources ({b.research.sources.length})</div>
                        <ul className="grid gap-1.5 sm:grid-cols-2">
                          {b.research.sources.map((s) => (
                            <li key={s.url} className="min-w-0"><a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate text-xs text-cyan/80 hover:text-cyan"><ExternalLink className="size-3 shrink-0" /><span className="truncate">{s.title || hostOf(s.url)}</span></a></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-fg-muted">
                    {scan.aiMode === "deep" ? "Research hasn't run for this business yet." : "Web research wasn't enabled for this scan. Run a scan with Deep research (needs ANTHROPIC_API_KEY) to get reviews, social following, competitors and owner details from the web."}
                  </p>
                )}
              </Card>
            </Reveal>
            <Reveal delay={0.05}>
              <TechPanel b={b} />
            </Reveal>
          </section>
        </>
      )}
    </main>
  );
}

function hostOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

function ContactLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const external = href.startsWith("http");
  return (
    <a href={href} target={external ? "_blank" : undefined} rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-fg-muted ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-fg">
      <span className="text-violet">{icon}</span><span className="truncate">{label}</span>
    </a>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
      <dt className="text-[11px] text-fg-faint">{k}</dt>
      <dd className="mt-0.5 font-medium capitalize">{v}</dd>
    </div>
  );
}

function Objection({ objection, response, defaultOpen }: { objection: string; response: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium" aria-expanded={open}>
        "{objection}"
        <ChevronDown className={clsx("size-4 shrink-0 text-fg-faint transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="px-4 pb-4 text-sm text-fg-muted">{response}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Outreach({ subject, body }: { subject: string; body: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Card
      title="Outreach message"
      icon={<Mail className="size-4" />}
      className="h-full"
      action={
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-xs ring-1 ring-white/10 transition hover:bg-white/10">
          {copied ? <Check className="size-3.5 text-lime" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      }
    >
      <div className="rounded-xl bg-ink-900/60 p-4 ring-1 ring-white/5">
        <div className="border-b border-white/5 pb-2 text-sm"><span className="text-fg-faint">Subject:</span> {subject}</div>
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-fg-muted">{body}</p>
      </div>
    </Card>
  );
}

function TechPanel({ b }: { b: Business }) {
  const c = b.crawl;
  const g = b.google;
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2 text-sm last:border-0">
      <span className="shrink-0 text-fg-faint">{k}</span>
      <span className="text-right text-fg-muted">{v}</span>
    </div>
  );
  const list = (a: string[]) => (a.length ? a.join(", ") : <span className="text-fg-faint">none</span>);
  const yes = (v: boolean) => (v ? <span className="text-lime">yes</span> : <span className="text-rose">no</span>);
  return (
    <div className="flex h-full flex-col gap-6">
      <Card title="Website crawl" icon={<Code2 className="size-4" />}>
        {!b.website ? (
          <p className="text-sm text-fg-muted">No website found for this business.</p>
        ) : !c ? (
          <p className="text-sm text-fg-muted">Not crawled yet.</p>
        ) : !c.ok ? (
          <p className="text-sm text-rose">{c.error ?? "Unreachable"}</p>
        ) : (
          <div>
            {row("Pages crawled", c.pagesCrawled.length)}
            {row("Response time", c.loadMs ? `${(c.loadMs / 1000).toFixed(2)}s` : "–")}
            {row("HTTPS", yes(c.https))}
            {row("Mobile viewport", yes(c.hasViewport))}
            {row("Tech stack", list(c.tech))}
            {row("Analytics", list(c.analytics))}
            {row("Booking / ordering", list(c.booking))}
            {row("E-commerce", list(c.ecommerce))}
            {row("Chat", list(c.chat))}
            {row("Schema.org", list(c.jsonLdTypes))}
            {row("Copyright year", c.copyrightYear ?? "–")}
            {row("Words", c.wordCount.toLocaleString())}
          </div>
        )}
      </Card>
      <Card title="Google Maps" icon={<Target className="size-4" />}>
        {g ? (
          <div>
            {row("Rating", g.rating ? `${g.rating.toFixed(1)}★ (${g.reviewCount ?? 0} reviews)` : "–")}
            {row("Price level", g.priceLevel ?? "–")}
            {row("Type", g.primaryType ?? "–")}
            {row("Status", g.businessStatus ?? "–")}
            {g.reviews.length > 0 && (
              <div className="mt-3 space-y-2">
                {g.reviews.slice(0, 3).map((rv, i) => (
                  <blockquote key={i} className="rounded-lg bg-white/[0.03] p-2.5 text-xs text-fg-muted ring-1 ring-white/5">
                    <span className="text-amber">{"★".repeat(Math.round(rv.rating))}</span> {rv.text.slice(0, 220)}{rv.text.length > 220 ? "…" : ""}
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Add <code className="rounded bg-white/10 px-1">GOOGLE_PLACES_API_KEY</code> for ratings, review volume and review text.</p>
        )}
      </Card>
    </div>
  );
}
