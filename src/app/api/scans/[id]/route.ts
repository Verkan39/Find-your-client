import { NextResponse } from "next/server";
import { authed, notFound } from "@/lib/api";
import { deleteScan, getScan, listBusinesses, logEvent, recentEvents, scanCounts, updateScan } from "@/lib/db";
import { enqueueScan, resumeAll } from "@/lib/pipeline";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { supabase, denied } = await authed();
  if (denied) return denied;
  resumeAll();
  const { id } = await params;
  const scan = await getScan(supabase, id); // RLS: null unless it's yours
  if (!scan) return notFound();
  const [all, counts, events] = await Promise.all([listBusinesses(supabase, id), scanCounts(supabase, id), recentEvents(supabase, id)]);
  // The list view doesn't need crawl text, research notes or the full pitch.
  const businesses = all.map(({ crawl, research, report, tags, ...b }) => ({
    ...b,
    hasWebsite: Boolean(b.website),
    tech: crawl?.tech ?? [],
    report: report && {
      source: report.source,
      summary: report.summary,
      scores: report.scores,
      revenue: report.revenue,
      profile: report.profile,
      topService: report.pitch.services[0] ?? null,
      gapCount: report.audit.gaps.length,
    },
  }));
  return NextResponse.json({ scan, counts, businesses, events });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { supabase, denied } = await authed();
  if (denied) return denied;
  const { id } = await params;
  if (!(await getScan(supabase, id))) return notFound();
  await deleteScan(supabase, id);
  return NextResponse.json({ ok: true });
}

/** Retry a failed scan; it resumes from whatever stage it reached. */
export async function POST(_req: Request, { params }: Ctx) {
  const { supabase, denied } = await authed();
  if (denied) return denied;
  const { id } = await params;
  const scan = await getScan(supabase, id); // ownership check
  if (!scan) return notFound();
  if (scan.status === "failed") {
    await updateScan(admin(), id, { status: "queued", error: null });
    await logEvent(admin(), id, "Retrying scan…");
  }
  enqueueScan(id);
  return NextResponse.json({ ok: true });
}
