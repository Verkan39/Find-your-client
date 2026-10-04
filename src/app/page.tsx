"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight, Bot, Building2, CheckCircle2, Globe2, Mail, MapPinned, Radar, Search, Sparkles, Target, TrendingUp, Users,
} from "lucide-react";
import { useRef } from "react";
import { HeroScene } from "@/components/three";
import { Reveal, TiltCard } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";

const STEPS = [
  { icon: MapPinned, title: "Discover", body: "Pick a neighbourhood. We map every independent business in it from OpenStreetMap and skip the chains that never hire freelancers." },
  { icon: Search, title: "Audit", body: "Each website is crawled: speed, mobile, HTTPS, SEO, tech stack, booking, analytics, socials. No website gets noticed too." },
  { icon: Bot, title: "Research", body: "Claude searches the web for each business: reviews, social following, delivery apps, competitors, owner, size signals." },
  { icon: Target, title: "Pitch", body: "You get revenue estimates, scores, who their customers are, and the exact offer, price and message they're likely to accept." },
];

export default function Home() {
  const hero = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "60%"]);

  return (
    <main className="relative">
      {/* ------------------------------ hero ------------------------------ */}
      <section ref={hero} className="relative min-h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(111,92,255,0.22),transparent_55%),radial-gradient(ellipse_at_20%_80%,rgba(63,215,242,0.10),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <motion.div style={{ y: sceneY, opacity: sceneOpacity }} className="absolute inset-0 lg:left-[30%]">
          <HeroScene />
        </motion.div>

        <motion.div style={{ y: textY }} className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 pt-24 pb-16 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-fg-muted"
          >
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-lime" /></span>
            Lead intelligence for freelance developers
          </motion.div>

          <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.035em] sm:text-7xl lg:text-[5.5rem]">
            {["Find", "the", "businesses"].map((w, i) => (
              <motion.span key={w} className="mr-[0.25em] inline-block" initial={{ opacity: 0, y: 40, rotateX: -60 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.1 + i * 0.08, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}>
                {w}
              </motion.span>
            ))}
            <br />
            {["that", "need"].map((w, i) => (
              <motion.span key={w} className="mr-[0.25em] inline-block" initial={{ opacity: 0, y: 40, rotateX: -60 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.34 + i * 0.08, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}>
                {w}
              </motion.span>
            ))}
            <motion.span className="inline-block text-gradient" initial={{ opacity: 0, y: 40, rotateX: -60 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}>
              you.
            </motion.span>
          </h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75, duration: 0.8 }} className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
            Scan any neighbourhood. We analyse every local business for revenue, online visibility, customers and digital gaps,
            then tell you <span className="text-fg">what to pitch, at what price, and what they'll agree to.</span>
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/dashboard#new-scan" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-fg px-6 py-3 font-medium text-ink-950 shadow-[0_0_40px_-8px] shadow-violet transition hover:shadow-violet">
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-violet/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              Start scanning
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#how" className="rounded-full px-5 py-3 text-sm text-fg-muted ring-1 ring-white/10 transition hover:bg-white/5 hover:text-fg">
              How it works
            </a>
          </motion.div>

          {/* floating insight chips */}
          <div className="pointer-events-none absolute right-6 bottom-24 hidden flex-col gap-3 xl:flex">
            {[
              { icon: TrendingUp, k: "Est. revenue", v: "₹1.8Cr – ₹3.4Cr / yr", c: "text-lime", d: 1.1 },
              { icon: Globe2, k: "Digital maturity", v: "23 / 100 · no booking", c: "text-amber", d: 1.25 },
              { icon: CheckCircle2, k: "They'll say yes to", v: "Online booking · 74%", c: "text-cyan", d: 1.4 },
            ].map((chip) => (
              <motion.div key={chip.k} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: chip.d, duration: 0.7 }} className="animate-float glass flex items-center gap-3 rounded-2xl px-4 py-3" style={{ animationDelay: `${chip.d}s` }}>
                <chip.icon className={`size-4 ${chip.c}`} />
                <div>
                  <div className="text-[11px] text-fg-faint">{chip.k}</div>
                  <div className="text-sm font-medium">{chip.v}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-950" />
      </section>

      {/* --------------------------- categories marquee --------------------------- */}
      <section className="relative border-y border-white/5 py-6">
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="flex shrink-0 animate-marquee gap-3 pr-3">
            {[...CATEGORIES, ...CATEGORIES].map((c, i) => (
              <span key={i} className="whitespace-nowrap rounded-full bg-white/[0.03] px-4 py-1.5 text-sm text-fg-muted ring-1 ring-white/[0.06]">
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ how it works ------------------------------ */}
      <section id="how" className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6">
        <Reveal>
          <p className="text-sm font-medium tracking-wide text-violet uppercase">The pipeline</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Slow on purpose. <span className="text-fg-muted">Deep by design.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-fg-muted">
            Every business goes through a four-stage pipeline in the background. Start a scan, grab a coffee, come back to a ranked list of
            clients with a ready-made pitch.
          </p>
        </Reveal>

        <div className="relative mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="pointer-events-none absolute top-11 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-violet/0 via-violet/50 to-cyan/0 lg:block" />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <TiltCard className="h-full rounded-2xl">
                <div className="glass ring-gradient relative h-full rounded-2xl p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-violet/25 to-cyan/10 ring-1 ring-white/10">
                      <s.icon className="size-5 text-fg" />
                    </span>
                    <span className="font-display text-3xl font-semibold text-white/10">0{i + 1}</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* -------------------------------- bento -------------------------------- */}
      <section className="relative mx-auto max-w-7xl px-4 pb-28 sm:px-6">
        <Reveal>
          <p className="text-sm font-medium tracking-wide text-cyan uppercase">What you get</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">A full brief on every lead.</h2>
        </Reveal>

        <div className="mt-12 grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-4 md:row-span-2" delay={0.05}>
            <TiltCard className="h-full rounded-3xl" intensity={4}>
              <div className="glass relative h-full overflow-hidden rounded-3xl p-7">
                <div className="flex items-center gap-2 text-sm text-fg-muted"><Target className="size-4 text-lime" /> The pitch</div>
                <h3 className="mt-3 max-w-md font-display text-2xl font-semibold">"Help Spice Route win more direct orders with commission-free ordering"</h3>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    { n: "Direct online ordering", p: "₹25k – ₹45k", a: 74 },
                    { n: "Local SEO & Google profile", p: "₹6k / month", a: 61 },
                    { n: "Review generation engine", p: "₹8k – ₹12k", a: 58 },
                    { n: "Customer CRM & loyalty", p: "₹30k – ₹40k", a: 36 },
                  ].map((s) => (
                    <div key={s.n} className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                      <div className="flex items-center justify-between text-sm"><span className="font-medium">{s.n}</span><span className="text-fg-muted">{s.p}</span></div>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" initial={{ width: 0 }} whileInView={{ width: `${s.a}%` }} viewport={{ once: true }} transition={{ duration: 1.2 }} /></div>
                        <span className="w-14 text-right text-xs tabular-nums text-fg-muted">{s.a}% yes</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-lime/[0.06] p-4 text-sm ring-1 ring-lime/20">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime" />
                  <p><span className="font-medium text-lime">Most likely yes:</span> <span className="text-fg-muted">a direct ordering page for their regulars. It pays for itself after ~120 orders saved from aggregator commission.</span></p>
                </div>
              </div>
            </TiltCard>
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.1}>
            <div className="glass h-full rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm text-fg-muted"><TrendingUp className="size-4 text-violet" /> Revenue estimate</div>
              <div className="mt-4 font-display text-3xl font-semibold">₹1.8Cr – ₹3.4Cr</div>
              <p className="mt-2 text-sm text-fg-muted">Triangulated from category norms, review volume, price tier and local purchasing power.</p>
            </div>
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.15}>
            <div className="glass h-full rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm text-fg-muted"><Users className="size-4 text-cyan" /> Target customers</div>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
                {[["35%", "var(--color-series-1)"], ["30%", "var(--color-series-2)"], ["25%", "var(--color-series-3)"], ["10%", "var(--color-series-4)"]].map(([w, c], i) => (
                  <span key={i} className="h-full border-r-2 border-ink-900 last:border-0" style={{ width: w, background: c }} />
                ))}
              </div>
              <p className="mt-3 text-sm text-fg-muted">Families · young professionals · delivery · tourists, with how each finds the business.</p>
            </div>
          </Reveal>

          <Reveal className="md:col-span-3" delay={0.1}>
            <div className="glass h-full rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm text-fg-muted"><Mail className="size-4 text-amber" /> Outreach, written for you</div>
              <p className="mt-4 font-mono text-[13px] leading-relaxed text-fg-muted">
                Hi there, I came across Spice Route on Zomato. Your 4.6★ reviews are great, but every regular who reorders pays the app 25%…
              </p>
            </div>
          </Reveal>
          <Reveal className="md:col-span-3" delay={0.15}>
            <div className="glass h-full rounded-3xl p-6">
              <div className="flex items-center gap-2 text-sm text-fg-muted"><Radar className="size-4 text-lime" /> Lead constellation</div>
              <p className="mt-4 text-sm text-fg-muted">
                Explore every business in a 3D map of opportunity vs digital maturity vs revenue. The bright ones high up and to the left are where your next client is.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------- cta ---------------------------------- */}
      <section className="relative mx-auto max-w-7xl px-4 pb-32 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] p-10 text-center ring-1 ring-white/10 sm:p-16">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,123,255,0.35),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(63,215,242,0.15),transparent_60%)]" />
            <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
            <div className="relative">
              <Sparkles className="mx-auto size-8 text-violet" />
              <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your next client is a few streets away.</h2>
              <p className="mx-auto mt-4 max-w-lg text-fg-muted">Run your first scan in under a minute. Works without any API keys, and gets much deeper with them.</p>
              <Link href="/dashboard#new-scan" className="mt-8 inline-flex items-center gap-2 rounded-full bg-fg px-6 py-3 font-medium text-ink-950 transition hover:bg-white">
                <Building2 className="size-4" /> Scan a neighbourhood
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-fg-faint">
        Map data © OpenStreetMap contributors · Estimates are directional, so verify before quoting.
      </footer>
    </main>
  );
}
