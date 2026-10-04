"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { KeyRound, LayoutDashboard, LogOut, Radar, UserRound } from "lucide-react";
import clsx from "clsx";
import { Magnetic } from "./PointerFX";

export interface NavUser {
  email: string;
  name: string | null;
}

export function Nav({ user }: { user: NavUser | null }) {
  const path = usePathname();
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["rgba(4,5,10,0)", "rgba(4,5,10,0.72)"]);
  const border = useTransform(scrollY, [0, 80], ["rgba(255,255,255,0)", "rgba(255,255,255,0.07)"]);

  const links = user
    ? [{ href: "/", label: "Home" }, { href: "/dashboard", label: "Dashboard" }]
    : [{ href: "/", label: "Home" }];

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
          {user ? (
            <>
              <Magnetic className="ml-2 hidden sm:block" strength={0.25}>
                <Link href="/dashboard#new-scan" className="block rounded-full bg-fg px-4 py-1.5 text-sm font-medium text-ink-950 transition hover:bg-white">
                  New scan
                </Link>
              </Magnetic>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link href="/login" className={clsx("rounded-full px-4 py-1.5 text-sm transition-colors", path === "/login" ? "text-fg" : "text-fg-muted hover:text-fg")}>
                Log in
              </Link>
              <Magnetic className="ml-1" strength={0.25}>
                <Link href="/signup" className="block rounded-full bg-fg px-4 py-1.5 text-sm font-medium text-ink-950 transition hover:bg-white">
                  Get started
                </Link>
              </Magnetic>
            </>
          )}
        </div>
      </nav>
    </motion.header>
  );
}

function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = user.name || user.email;
  const initials = label
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-violet/40 to-cyan/30 text-xs font-semibold ring-1 ring-white/15 transition hover:ring-white/30"
      >
        {initials}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-ink-800 p-1.5 shadow-2xl ring-1 ring-white/10"
          >
            <div className="px-3 py-2.5">
              {user.name && <div className="truncate text-sm font-medium">{user.name}</div>}
              <div className="truncate text-xs text-fg-muted">{user.email}</div>
            </div>
            <div className="my-1 h-px bg-white/[0.06]" />
            <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg-muted transition hover:bg-white/[0.06] hover:text-fg">
              <LayoutDashboard className="size-4" /> Dashboard
            </Link>
            <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg-muted transition hover:bg-white/[0.06] hover:text-fg">
              <UserRound className="size-4" /> Profile
            </Link>
            <Link href="/profile#keys" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg-muted transition hover:bg-white/[0.06] hover:text-fg">
              <KeyRound className="size-4" /> API keys
            </Link>
            <form action="/auth/signout" method="post">
              <button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-fg-muted transition hover:bg-rose/10 hover:text-rose">
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
