"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

const INTERACTIVE = "a, button, select, input, textarea, label, [role='button'], [data-cursor='hover']";

/**
 * Site-wide pointer layer:
 *  - a soft ambient light that follows the cursor across every page
 *  - per-card spotlight coordinates (--mx/--my) consumed by the `glass` utility
 *  - a trailing cursor ring that grows over anything clickable
 * Activated by the first real mouse movement, so touch devices keep the plain UI.
 */
export function PointerFX() {
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 350, damping: 32, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 350, damping: 32, mass: 0.6 });
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let lastX = 0;
    let lastY = 0;

    const paint = () => {
      frame = 0;
      root.style.setProperty("--cx", `${lastX}px`);
      root.style.setProperty("--cy", `${lastY}px`);
      document.querySelectorAll<HTMLElement>(".glass").forEach((el) => {
        const r = el.getBoundingClientRect();
        // Skip off-screen cards; the gradient can't reach them anyway.
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        el.style.setProperty("--mx", `${lastX - r.left}px`);
        el.style.setProperty("--my", `${lastY - r.top}px`);
      });
    };
    const move = (e: PointerEvent) => {
      // Only a real mouse turns the effects on; touch and pen keep the plain UI.
      if (e.pointerType !== "mouse") return;
      setEnabled(true);
      lastX = e.clientX;
      lastY = e.clientY;
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
      root.style.setProperty("--spot", "1");
      const t = e.target as Element | null;
      setHovering(Boolean(t?.closest?.(INTERACTIVE)));
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      setVisible(false);
      root.style.setProperty("--spot", "0");
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const down = () => setPressed(true);
    const up = () => setPressed(false);

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <>
      {/* ambient light behind all content */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-500"
        style={{
          opacity: visible ? 1 : 0,
          background: "radial-gradient(650px circle at var(--cx) var(--cy), rgb(111 92 255 / 0.075), transparent 60%)",
        }}
      />
      {/* trailing ring */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[200] rounded-full border border-white/40 motion-reduce:hidden"
        style={{ x: ringX, y: ringY, translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: hovering ? 44 : 28,
          height: hovering ? 44 : 28,
          opacity: visible ? 1 : 0,
          scale: pressed ? 0.8 : 1,
          backgroundColor: hovering ? "rgba(139,123,255,0.12)" : "rgba(139,123,255,0)",
          borderColor: hovering ? "rgba(139,123,255,0.7)" : "rgba(255,255,255,0.35)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      />
    </>
  );
}

/** Pulls its child gently toward the cursor while hovered. */
export function Magnetic({ children, strength = 0.3, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 220, damping: 16, mass: 0.4 });
  return (
    <motion.div
      className={className ?? "inline-block"}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - (r.left + r.width / 2)) * strength);
        my.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
    >
      {children}
    </motion.div>
  );
}
