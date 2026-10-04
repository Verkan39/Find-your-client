"use client";

import { animate, motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Flame, Snowflake, Sun } from "lucide-react";

/* ------------------------------ lead tiers ------------------------------ */

export function tierOf(score: number | null | undefined) {
  const s = score ?? 0;
  if (s >= 70) return { key: "hot", label: "Hot lead", color: "var(--color-lime)", Icon: Flame } as const;
  if (s >= 50) return { key: "warm", label: "Warm lead", color: "var(--color-amber)", Icon: Sun } as const;
  return { key: "cool", label: "Cool lead", color: "#7c86a8", Icon: Snowflake } as const;
}

export function TierBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  const t = tierOf(score);
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", className)}
      style={{ color: t.color, backgroundColor: `color-mix(in oklab, ${t.color} 12%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${t.color} 30%, transparent)` }}
    >
      <t.Icon className="size-3" />
      {t.label}
    </span>
  );
}

/* ----------------------------- score ring ----------------------------- */

export function ScoreRing({ value, size = 56, stroke = 5, label, className }: {
  value: number; size?: number; stroke?: number; label?: string; className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const t = tierOf(value);
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div className={clsx("relative inline-grid place-items-center", className)} style={{ width: size, height: size }} aria-label={`${label ?? "Score"} ${value} out of 100`}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: inView ? c * (1 - value / 100) : c }}
          transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${t.color})` }}
        />
      </svg>
      <span className="absolute font-display font-semibold tabular-nums" style={{ fontSize: size * 0.3 }}>
        <AnimatedNumber value={value} />
      </span>
    </div>
  );
}

/* ------------------------------- meter ------------------------------- */

/** Single-hue magnitude bar; value text is always shown, never color-only. */
export function Meter({ label, value, hint, className }: { label: string; value: number; hint?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className={clsx("group", className)} title={hint}>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="font-medium tabular-nums text-fg">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet to-cyan"
          initial={{ width: 0 }}
          animate={{ width: inView ? `${value}%` : 0 }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

/* -------------------------- animated number -------------------------- */

export function AnimatedNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 1.1,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return <>{format ? format(display) : Math.round(display)}</>;
}

/* ------------------------------ reveal ------------------------------ */

export function Reveal({ children, delay = 0, className, y = 24 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------- tilt card ---------------------------- */

export function TiltCard({ children, className, intensity = 8 }: { children: ReactNode; className?: string; intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [intensity, -intensity]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-intensity, intensity]), { stiffness: 200, damping: 20 });
  const glowX = useTransform(mx, (v) => `${v * 100}%`);
  const glowY = useTransform(my, (v) => `${v * 100}%`);
  const glow = useTransform([glowX, glowY], ([x, y]) => `radial-gradient(420px circle at ${x} ${y}, rgb(139 123 255 / 0.13), transparent 45%)`);
  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={clsx("group relative", className)}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glow }}
      />
      {children}
    </motion.div>
  );
}

/* ------------------------------ misc ------------------------------ */

export function Card({ children, className, title, icon, action }: {
  children: ReactNode; className?: string; title?: ReactNode; icon?: ReactNode; action?: ReactNode;
}) {
  return (
    <section className={clsx("glass rounded-2xl p-5 sm:p-6", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
            {icon && <span className="text-violet">{icon}</span>}
            {title}
          </h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Pill({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "good" | "warn" | "bad" | "info"; className?: string }) {
  const tones = {
    default: "bg-white/[0.06] text-fg-muted ring-white/10",
    good: "bg-lime/10 text-lime ring-lime/25",
    warn: "bg-amber/10 text-amber ring-amber/25",
    bad: "bg-rose/10 text-rose ring-rose/25",
    info: "bg-cyan/10 text-cyan ring-cyan/25",
  };
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block size-3.5 animate-spin rounded-full border-2 border-white/15 border-t-cyan", className)} />;
}

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const STAGE_LABEL: Record<string, string> = {
  pending: "Queued",
  crawling: "Crawling website",
  enriching: "Checking Google Maps",
  scoring: "Scoring",
  researching: "Researching the web",
  writing: "Writing pitch",
  done: "Done",
  failed: "Failed",
  queued: "Queued",
  geocoding: "Locating region",
  discovering: "Discovering businesses",
  analyzing: "Analysing",
};
