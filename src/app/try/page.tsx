"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * "Try it free": starts a guest session (Supabase anonymous sign-in) and drops
 * the visitor on the dashboard. Anyone already signed in just goes straight there.
 */
export default function TryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const sb = createClient();
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) {
          setError(/disabled|not allowed/i.test(error.message)
            ? "Guest mode isn't enabled on this server yet."
            : /rate limit|too many/i.test(error.message)
              ? "Too many guest sessions from your network right now. Try again in a bit, or create a free account."
              : error.message);
          return;
        }
      }
      router.replace("/dashboard#new-scan");
      router.refresh();
    })();
  }, [router]);

  return (
    <main className="grid min-h-svh place-items-center px-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass ring-gradient w-full max-w-sm rounded-3xl p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet/30 to-cyan/20 ring-1 ring-white/10">
          <Radar className={error ? "size-6 text-rose" : "size-6 animate-spin text-violet [animation-duration:2.4s]"} />
        </span>
        {error ? (
          <>
            <h1 className="mt-5 font-display text-xl font-semibold">Couldn't start a guest session</h1>
            <p className="mt-2 text-sm text-fg-muted">{error}</p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/signup" className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-ink-950">Create free account</Link>
              <Link href="/login" className="rounded-full px-4 py-2 text-sm text-fg-muted ring-1 ring-white/10 hover:text-fg">Log in</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-5 font-display text-xl font-semibold">Setting up your guest workspace…</h1>
            <p className="mt-2 text-sm text-fg-muted">No signup needed. Sign up any time to keep your results.</p>
          </>
        )}
      </motion.div>
    </main>
  );
}
