"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, X } from "lucide-react";

const HIDDEN_ON = ["/", "/login", "/signup", "/try", "/forgot-password", "/reset-password"];
const DISMISS_KEY = "fyc-guestbar-dismissed";

/** Floating reminder for guests: results are temporary until they sign up. */
export function GuestBar() {
  const path = usePathname();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
  }, []);
  const show = !dismissed && !HIDDEN_ON.includes(path);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.6 }}
          className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
        >
          <div className="glass-strong flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl ring-1 ring-amber/20 sm:flex-nowrap">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber/15 text-amber"><Clock className="size-4" /></span>
            <p className="min-w-0 flex-1 text-sm text-fg-muted">
              <span className="text-fg">You're exploring as a guest.</span> Results are deleted after 24 hours. Sign up to keep them.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/signup" className="rounded-full bg-fg px-4 py-1.5 text-sm font-medium text-ink-950 transition hover:bg-white">Save my results</Link>
              <button
                onClick={() => { setDismissed(true); try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {} }}
                aria-label="Dismiss"
                className="grid size-8 place-items-center rounded-full text-fg-faint transition hover:bg-white/5 hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
