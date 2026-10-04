import Anthropic from "@anthropic-ai/sdk";
import { AIRefusalError, aiEnabled, research, writeReport } from "./ai";
import { crawlSite } from "./crawler";
import * as db from "./db";
import { discover, geocode } from "./discovery";
import { enrichFromGoogle, googleEnabled } from "./google";
import { heuristicReport, type AnalysisContext } from "./heuristics";
import { market } from "./market";
import type { Business, Scan } from "./types";

/**
 * In-process job runner. Scans run in the background of the Next.js server; state lives in
 * SQLite so an interrupted scan resumes where it left off when the server restarts.
 */
const g = globalThis as unknown as { __fycRunning?: Set<string>; __fycResumed?: boolean };
const running = (g.__fycRunning ??= new Set<string>());

const concurrency = () => Math.max(1, Math.min(8, Number(process.env.ANALYSIS_CONCURRENCY) || 3));

export function enqueueScan(id: string) {
  if (running.has(id)) return;
  running.add(id);
  runScan(id)
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (db.getScan(id)) {
        db.updateScan(id, { status: "failed", error: msg });
        db.logEvent(id, `Scan failed: ${msg}`, "error");
      }
    })
    .finally(() => running.delete(id));
}

export function resumeAll() {
  if (g.__fycResumed) return;
  g.__fycResumed = true;
  for (const s of db.unfinishedScans()) enqueueScan(s.id);
}

async function runScan(id: string) {
  let scan = db.getScan(id);
  if (!scan) return;

  if (scan.lat == null || scan.lon == null) {
    db.updateScan(id, { status: "geocoding" });
    db.logEvent(id, `Locating "${scan.query}" on the map…`);
    const geo = await geocode(scan.query);
    db.updateScan(id, {
      label: geo.label, lat: geo.lat, lon: geo.lon,
      countryCode: geo.countryCode ?? "", currency: market(geo.countryCode).currency,
    });
    db.logEvent(id, `Found ${geo.label} (${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)})`, "success");
    scan = db.getScan(id)!;
  }

  if (scan.discovered === 0 && db.scanCounts(id).total === 0) {
    db.updateScan(id, { status: "discovering" });
    db.logEvent(id, `Scanning OpenStreetMap within ${(scan.radiusM / 1000).toFixed(1)} km for businesses…`);
    const { picked, found, chainsSkipped, institutionalSkipped } = await discover({
      lat: scan.lat!, lon: scan.lon!, radiusM: scan.radiusM, categories: scan.categories,
      max: scan.maxBusinesses, includeChains: scan.includeChains,
      onRetry: (m) => db.logEvent(id, m, "warn"),
    });
    if (!picked.length) throw new Error(`No matching businesses found within ${scan.radiusM / 1000} km. Try a bigger radius or more categories.`);
    db.insertBusinesses(id, picked);
    db.updateScan(id, { discovered: found });
    const skipped = [chainsSkipped && `${chainsSkipped} chain outlets`, institutionalSkipped && `${institutionalSkipped} institutional/public places`].filter(Boolean).join(", ");
    db.logEvent(id, `Found ${found} places${skipped ? ` (skipped ${skipped})` : ""}; selected ${picked.length} for deep analysis`, "success");
  }

  db.updateScan(id, { status: "analyzing" });
  const ai = aiEnabled() && scan.aiMode !== "off";
  db.logEvent(id, ai
    ? `Analysing with ${scan.aiMode === "deep" ? "web research + " : ""}Claude${googleEnabled() ? " and Google Maps data" : ""}…`
    : "Analysing with the built-in scoring engine (add ANTHROPIC_API_KEY for AI research)…");

  const queue = db.pendingBusinesses(id);
  const workers = Array.from({ length: concurrency() }, async () => {
    while (queue.length) {
      const b = queue.shift()!;
      const current = db.getScan(id);
      if (!current) return; // scan deleted mid-run
      await analyzeBusiness(b, current);
    }
  });
  await Promise.all(workers);

  if (!db.getScan(id)) return;
  const counts = db.scanCounts(id);
  db.updateScan(id, { status: "done" });
  db.logEvent(id, `Done: ${counts.done} businesses analysed${counts.failed ? `, ${counts.failed} failed` : ""}`, "success");
}

function contextFor(b: Business, scan: Scan): AnalysisContext {
  const peers = db.listBusinesses(scan.id)
    .filter((p) => p.category === b.category && p.id !== b.id)
    .map((p) => ({ name: p.name, hasWebsite: Boolean(p.website) }));
  return {
    countryCode: scan.countryCode || null,
    currency: scan.currency,
    region: scan.label?.split(",")[0] ?? scan.query,
    peers,
  };
}

function describeAiError(e: unknown): string {
  if (e instanceof AIRefusalError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "Anthropic API key was rejected";
  if (e instanceof Anthropic.RateLimitError) return "Anthropic rate limit hit";
  if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status ?? ""}: ${e.message}`.trim();
  return e instanceof Error ? e.message : String(e);
}

export async function analyzeBusiness(b: Business, scan: Scan) {
  const log = (m: string, level: "info" | "success" | "warn" | "error" = "info") => db.logEvent(scan.id, m, level, b.id);
  try {
    // 1. Crawl their website
    let crawl = b.crawl;
    if (b.website && !crawl) {
      db.updateBusiness(b.id, { status: "crawling" });
      crawl = await crawlSite(b.website);
      db.updateBusiness(b.id, {
        crawl,
        email: b.email ?? crawl.emails[0] ?? null,
        phone: b.phone ?? crawl.phones[0] ?? null,
      });
      log(crawl.ok ? `Crawled ${b.name}: ${crawl.pagesCrawled.length} page(s), ${crawl.tech.slice(0, 2).join(", ") || "custom stack"}` : `${b.name}: website unreachable (${crawl.error})`, crawl.ok ? "info" : "warn");
    }

    // 2. Google Maps enrichment
    let biz = db.getBusiness(b.id)!;
    if (googleEnabled() && !biz.google) {
      db.updateBusiness(b.id, { status: "enriching" });
      try {
        const google = await enrichFromGoogle(biz);
        if (google) {
          db.updateBusiness(b.id, { google, phone: biz.phone ?? google.phone ?? null });
          if (!biz.website && google.website) {
            db.updateBusiness(b.id, { website: google.website, crawl: await crawlSite(google.website) });
          }
        }
      } catch (e) {
        log(`Google lookup failed for ${b.name}: ${e instanceof Error ? e.message : e}`, "warn");
      }
      biz = db.getBusiness(b.id)!;
    }

    // 3. Heuristic scoring - always runs, gives an instant baseline
    db.updateBusiness(b.id, { status: "scoring" });
    const ctx = contextFor(biz, scan);
    let baseline = heuristicReport(biz, ctx);
    db.updateBusiness(b.id, { report: baseline, opportunity: baseline.scores.opportunity });

    // 4-5. AI research + synthesis
    if (aiEnabled() && scan.aiMode !== "off") {
      try {
        let res = biz.research;
        if (scan.aiMode === "deep" && !res) {
          db.updateBusiness(b.id, { status: "researching" });
          log(`Researching ${b.name} on the web…`);
          res = await research(biz, ctx, baseline);
          db.updateBusiness(b.id, { research: res });
          log(`Research on ${b.name}: ${res.searches} searches/fetches, ${res.sources.length} sources`);

          // Map data often lacks websites/socials; adopt what the research found and audit it too.
          const found = res.found ?? {};
          const socials = { ...biz.socials };
          if (found.instagram && !socials.instagram) socials.instagram = found.instagram;
          if (found.facebook && !socials.facebook) socials.facebook = found.facebook;
          db.updateBusiness(b.id, { socials });
          if (found.website && !biz.website) {
            log(`Found ${b.name}'s website via research: ${found.website}`);
            db.updateBusiness(b.id, { website: found.website, crawl: await crawlSite(found.website) });
          }
          biz = db.getBusiness(b.id)!;
          baseline = heuristicReport(biz, ctx);
          db.updateBusiness(b.id, { report: baseline, opportunity: baseline.scores.opportunity });
        }
        db.updateBusiness(b.id, { status: "writing" });
        const report = await writeReport(biz, ctx, baseline, res);
        db.updateBusiness(b.id, { report, opportunity: report.scores.opportunity });
      } catch (e) {
        log(`AI analysis for ${b.name} failed, kept heuristic report: ${describeAiError(e)}`, "warn");
      }
    }

    const final = db.getBusiness(b.id)!;
    db.updateBusiness(b.id, { status: "done", error: null });
    log(`${b.name} scored ${final.opportunity}/100`, (final.opportunity ?? 0) >= 70 ? "success" : "info");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.updateBusiness(b.id, { status: "failed", error: msg });
    log(`${b.name} failed: ${msg}`, "error");
  }
}

/** Re-run analysis for a single business (e.g. after adding an API key). */
export function reanalyze(businessId: string, opts: { fresh: boolean }) {
  const b = db.getBusiness(businessId);
  if (!b) return false;
  const scan = db.getScan(b.scanId);
  if (!scan) return false;
  if (opts.fresh) db.updateBusiness(b.id, { crawl: null, google: null, research: null });
  db.updateBusiness(b.id, { status: "pending", error: null });
  const key = `biz:${b.id}`;
  if (running.has(key)) return true;
  running.add(key);
  analyzeBusiness(db.getBusiness(b.id)!, scan).finally(() => running.delete(key));
  return true;
}
