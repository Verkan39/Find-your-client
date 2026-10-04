"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { Radar } from "lucide-react";
import clsx from "clsx";

export function Nav() {
  const path = usePathname();
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["rgba(4,5,10,0)", "rgba(4,5,10,0.72)"]);
  const border = useTransform(scrollY, [0, 80], ["rgba(255,255,255,0)", "rgba(255,255,255,0.07)"]);

  const links = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <motion.header
      style={{ backgroundColor: bg, borderColor: border }}
      className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet to-cyan shadow-[0_0_24px_-4px] shadow-violet/60">
            <Radar className="size-4.5 text-ink-950 transition-transform duration-700 group-hover:rotate-180" strokeWidth={2.5} />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Find<span className="text-fg-muted">Your</span>Client
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href) || (l.href === "/dashboard" && (path.startsWith("/scans") || path.startsWith("/business")));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "relative rounded-full px-4 py-1.5 text-sm transition-colors",
                  active ? "text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {active && (
                  <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-white/[0.07] ring-1 ring-white/10" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
          <Link
            href="/dashboard#new-scan"
            className="ml-2 hidden rounded-full bg-fg px-4 py-1.5 text-sm font-medium text-ink-950 transition hover:bg-white sm:block"
          >
            New scan
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
