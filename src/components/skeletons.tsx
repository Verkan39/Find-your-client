import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Layout-matched loading placeholders. Each mirrors the real page's grid, card
 * sizes and spacing so content drops into place without the layout jumping.
 * They're used both by route `loading.tsx` files (shown the instant you navigate)
 * and by the client pages while their data is being fetched.
 */

export function Skel({ className }: { className?: string }) {
  // Only default the radius when the caller didn't pick one; two rounded-* classes
  // would be resolved by stylesheet order, not by which one was written last.
  const hasRadius = /(^|\s)rounded(-|\s|$)/.test(className ?? "");
  return <div aria-hidden className={clsx("skeleton", !hasRadius && "rounded-md", className)} />;
}

function Shell({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <main role="status" aria-busy="true" aria-live="polite" className={clsx("skeleton-enter relative mx-auto max-w-7xl px-4 pb-24 sm:px-6", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </main>
  );
}

function SkelCard({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={clsx("glass rounded-2xl p-5 sm:p-6", className)}>{children}</div>;
}

function SkelMeter() {
  return (
    <div>
      <div className="mb-2 flex justify-between"><Skel className="h-3 w-20" /><Skel className="h-3 w-6" /></div>
      <Skel className="h-1.5 w-full rounded-full" />
    </div>
  );
}

function SkelLines({ n = 3, last = "w-2/3" }: { n?: number; last?: string }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: n }, (_, i) => <Skel key={i} className={clsx("h-3", i === n - 1 ? last : "w-full")} />)}
    </div>
  );
}

/* ------------------------------- dashboard ------------------------------- */

export function ScanRowSkeleton() {
  return (
    <div className="glass rounded-2xl p-5">
      <Skel className="h-4 w-3/5" />
      <Skel className="mt-2.5 h-3 w-2/5" />
      <div className="mt-5 flex items-center gap-3">
        <Skel className="h-5 w-20 rounded-full" />
        <Skel className="h-3 w-24" />
        <Skel className="ml-auto h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function ScanListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }, (_, i) => <ScanRowSkeleton key={i} />)}</div>;
}

export function DashboardSkeleton() {
  return (
    <Shell label="Loading dashboard" className="pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skel className="h-3.5 w-24" />
          <Skel className="mt-3 h-11 w-72 sm:h-12 sm:w-80" />
        </div>
        <div className="flex gap-2"><Skel className="h-6 w-36 rounded-full" /><Skel className="h-6 w-36 rounded-full" /></div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div className="glass min-w-0 rounded-3xl p-6 sm:p-8">
          <Skel className="h-7 w-36" />
          <Skel className="mt-2 h-3.5 w-56" />
          <Skel className="mt-6 h-14 w-full rounded-2xl" />
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div><div className="mb-3 flex justify-between"><Skel className="h-3.5 w-14" /><Skel className="h-3.5 w-12" /></div><Skel className="h-2 w-full rounded-full" /></div>
            <div><Skel className="mb-3 h-3.5 w-48" /><div className="flex gap-2">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-9 flex-1 rounded-xl" />)}</div></div>
          </div>
          <Skel className="mt-7 h-3.5 w-28" />
          <div className="mt-3 space-y-3">
            {[5, 6, 3, 7].map((n, r) => (
              <div key={r} className="flex flex-wrap items-center gap-1.5">
                <Skel className="mr-1 h-3 w-full sm:w-28" />
                {Array.from({ length: n }, (_, i) => <Skel key={i} className={clsx("h-6 rounded-full", ["w-20", "w-14", "w-24", "w-16"][(i + r) % 4])} />)}
              </div>
            ))}
          </div>
          <Skel className="mt-7 h-3.5 w-32" />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skel key={i} className="h-28 rounded-2xl" />)}</div>
          <Skel className="mt-7 h-14 w-full rounded-2xl sm:w-44" />
        </div>

        <div className="min-w-0">
          <Skel className="mb-4 h-5 w-20" />
          <ScanListSkeleton />
        </div>
      </div>
    </Shell>
  );
}

/* --------------------------------- scan --------------------------------- */

export function LeadCardSkeleton() {
  return (
    <div className="glass h-full rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Skel className="h-4 w-3/5" />
          <Skel className="mt-2 h-3 w-4/5" />
        </div>
        <Skel className="size-[52px] shrink-0 rounded-full" />
      </div>
      <div className="mt-3 flex gap-1.5"><Skel className="h-5 w-20 rounded-full" /><Skel className="h-5 w-24 rounded-full" /></div>
      <div className="mt-4 grid grid-cols-2 gap-x-4"><SkelMeter /><SkelMeter /></div>
      <Skel className="mt-4 h-9 w-full rounded-xl" />
      <Skel className="mt-2 h-12 w-full rounded-xl" />
    </div>
  );
}

export function ScanSkeleton() {
  return (
    <Shell label="Loading scan" className="pt-24">
      <Skel className="h-4 w-24" />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Skel className="h-10 w-64 sm:h-12 sm:w-80" />
          <Skel className="mt-3 h-3.5 w-72 max-w-full sm:w-[30rem]" />
        </div>
        <div className="flex gap-2"><Skel className="h-5 w-24 rounded-full" /><Skel className="h-5 w-28 rounded-full" /></div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <Skel className="h-3 w-24" />
            <Skel className="mt-4 h-8 w-20" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="glass relative h-[460px] min-w-0 overflow-hidden rounded-3xl p-5">
          <Skel className="h-4 w-36" />
          <Skel className="mt-2 h-3 w-56" />
          {/* faint wireframe hint of the 3D lead map */}
          <div className="absolute inset-x-[18%] bottom-[16%] h-[38%] skew-x-[-24deg] rounded-xl border border-white/[0.05] bg-grid opacity-70" />
          {[[30, 40], [48, 28], [62, 46], [40, 58], [70, 34]].map(([left, top]) => (
            <div key={`${left}-${top}`} className="absolute" style={{ left: `${left}%`, top: `${top}%` }}>
              <Skel className="size-3 rounded-full" />
            </div>
          ))}
        </div>
        <div className="glass flex h-[460px] flex-col rounded-2xl p-5">
          <Skel className="h-4 w-28" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex gap-2.5">
                <Skel className="mt-1 size-1.5 shrink-0 rounded-full" />
                <div className="flex-1"><Skel className={clsx("h-3", i % 3 === 0 ? "w-11/12" : i % 3 === 1 ? "w-3/4" : "w-5/6")} /><Skel className="mt-1.5 h-2 w-12" /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <Skel className="h-7 w-28" />
        <div className="flex flex-wrap gap-2"><Skel className="h-9 w-44 rounded-xl" /><Skel className="h-9 w-32 rounded-xl" /><Skel className="h-9 w-40 rounded-xl" /><Skel className="h-9 w-16 rounded-xl" /></div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <LeadCardSkeleton key={i} />)}
      </div>
    </Shell>
  );
}

/* ------------------------------- business ------------------------------- */

export function BusinessSkeleton() {
  const heading = (
    <div className="mb-5">
      <Skel className="h-3 w-24" />
      <Skel className="mt-2.5 h-8 w-72 max-w-full" />
    </div>
  );
  return (
    <Shell label="Loading business brief" className="pt-24">
      <Skel className="h-4 w-28" />

      <section className="mt-4 grid items-center gap-6 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="flex flex-wrap gap-2"><Skel className="h-5 w-24 rounded-full" /><Skel className="h-5 w-20 rounded-full" /><Skel className="h-5 w-28 rounded-full" /></div>
          <Skel className="mt-4 h-11 w-4/5 sm:h-12" />
          <Skel className="mt-3 h-3.5 w-80 max-w-full" />
          <div className="mt-4 flex flex-wrap gap-2">{["w-36", "w-32", "w-44", "w-40"].map((w) => <Skel key={w} className={clsx("h-7 rounded-full", w)} />)}</div>
          <Skel className="mt-6 h-[60px] w-full rounded-2xl" />
        </div>
        <div className="relative mx-auto grid aspect-square w-full max-w-[260px] place-items-center">
          <Skel className="size-[62%] rounded-full" />
          <div className="absolute size-[86%] rounded-full border border-dashed border-white/[0.06]" />
        </div>
      </section>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass rounded-2xl p-4"><Skel className="h-2.5 w-16" /><Skel className="mt-3 h-7 w-24" /><Skel className="mt-2 h-3 w-20" /></div>
        ))}
      </div>

      <section className="mt-12">
        {heading}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="glass rounded-2xl p-4"><Skel className="h-2.5 w-20" /><Skel className="mt-3 h-8 w-16" /><Skel className="mt-2.5 h-3 w-full" /></div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        {heading}
        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-3">
            <SkelCard className="!p-5">
              <div className="flex justify-between"><div><Skel className="h-3 w-24" /><Skel className="mt-2.5 h-6 w-52" /><Skel className="mt-2 h-5 w-36" /></div><Skel className="size-[76px] rounded-full" /></div>
              <div className="mt-4 grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Skel key={i} className="h-12 rounded-xl" />)}</div>
            </SkelCard>
            <SkelCard className="!p-3">
              {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3 px-2 py-2.5"><Skel className="h-3.5 flex-1" /><Skel className="h-3.5 w-24" /><Skel className="hidden h-1.5 w-28 rounded-full sm:block" /></div>)}
            </SkelCard>
          </div>
          <SkelCard className="!p-2">
            <Skel className="h-8 w-full rounded-xl" />
            <div className="p-3"><Skel className="h-3.5 w-2/3" /><div className="mt-4"><SkelLines n={7} last="w-1/3" /></div></div>
          </SkelCard>
        </div>
      </section>

      <section className="mt-14">
        {heading}
        <div className="grid gap-4 lg:grid-cols-3">
          <SkelCard className="lg:row-span-2">
            <Skel className="h-3 w-32" /><Skel className="mt-4 h-1.5 w-full rounded-full" />
            <div className="mt-4 space-y-3">{Array.from({ length: 9 }, (_, i) => <div key={i} className="flex items-center gap-2.5"><Skel className="size-5 rounded-full" /><Skel className="h-3 flex-1" /><Skel className="h-3 w-16" /></div>)}</div>
          </SkelCard>
          {[0, 1, 2, 3].map((i) => <SkelCard key={i}><Skel className="h-3 w-24" /><Skel className="mt-4 h-8 w-40" /><div className="mt-4"><SkelLines n={3} /></div></SkelCard>)}
        </div>
      </section>
    </Shell>
  );
}
