import { NextResponse } from "next/server";
import { deleteScan, getScan, listBusinesses, logEvent, recentEvents, scanCounts, updateScan } from "@/lib/db";
import { enqueueScan, resumeAll } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  resumeAll();
  const { id } = await params;
  const scan = getScan(id);
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The list view doesn't need crawl text, research notes or the full pitch.
  const businesses = listBusinesses(id).map(({ crawl, research, report, tags, ...b }) => ({
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
  return NextResponse.json({ scan, counts: scanCounts(id), businesses, events: recentEvents(id) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  deleteScan(id);
  return NextResponse.json({ ok: true });
}

/** Retry a failed scan; it resumes from whatever stage it reached. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const scan = getScan(id);
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scan.status === "failed") {
    updateScan(id, { status: "queued", error: null });
    logEvent(id, "Retrying scan…");
  }
  enqueueScan(id);
  return NextResponse.json({ ok: true });
}
