import { research, writeReport } from "./ai";
import { crawlSite } from "./crawler";
import * as db from "./db";
import { discover, geocode } from "./discovery";
import { heuristicReport, type AnalysisContext } from "./heuristics";
import { loadUserConfig, type UserConfig } from "./keys";
import { market } from "./market";
import { enrichPlace } from "./places";
import { PROVIDERS } from "./providers/catalog";
import { admin } from "./supabase/admin";
import type { Business, Scan } from "./types";

/**
 * In-process job runner. Scans run in the background of the Next.js server and all
 * state lives in Supabase, so an interrupted scan resumes where it left off when the
 * server restarts. The worker uses the admin client because it acts on behalf of
 * whichever user owns the scan; API routes check ownership before enqueuing work.
 */
const g = globalThis as unknown as { __fycRunning?: Set<string>; __fycResumed?: boolean; __fycDraining?: boolean; __fycSigterm?: boolean };
const running = (g.__fycRunning ??= new Set<string>());

/*
 * Zero-downtime deploys briefly run the old and new server side by side. On
 * SIGTERM the old one stops taking new work and leaves unfinished scans as they
 * are; the new one resumes them after a short delay, so a scan is never
 * processed (and billed) twice.
 */
if (!g.__fycSigterm && typeof process !== "undefined" && process.once) {
  g.__fycSigterm = true;
  process.once("SIGTERM", () => {
    g.__fycDraining = true;
    console.log("[pipeline] SIGTERM: finishing in-flight businesses, leaving the rest for the next server");
  });
}
const draining = () => Boolean(g.__fycDraining);
const resumeDelayMs = () => Number(process.env.RESUME_DELAY_MS ?? (process.env.NODE_ENV === "production" ? 45_000 : 0));

const concurrency = () => Math.max(1, Math.min(8, Number(process.env.ANALYSIS_CONCURRENCY) || 3));

export function enqueueScan(id: string) {
  if (running.has(id) || draining()) return; // a draining server leaves it queued for the next one
  running.add(id);
  runScan(id)
    .catch(async (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      const sb = admin();
      if (await db.getScan(sb, id).catch(() => null)) {
        await db.updateScan(sb, id, { status: "failed", error: msg }).catch(() => {});
        await db.logEvent(sb, id, `Scan failed: ${msg}`, "error");
      }
    })
    .finally(() => running.delete(id));
}

/** Pick up scans that were mid-flight when the server last stopped. */
export function resumeAll() {
  if (g.__fycResumed) return;
  g.__fycResumed = true;
  setTimeout(() => {
    (async () => {
      for (const s of await db.unfinishedScans(admin())) enqueueScan(s.id);
    })().catch((e) => {
      g.__fycResumed = false; // try again on the next request
      console.warn(`[pipeline] couldn't resume scans: ${e instanceof Error ? e.message : e}`);
    });
  }, resumeDelayMs());
}

async function runScan(id: string) {
  const sb = admin();
  let scan = await db.getScan(sb, id);
  if (!scan) return;

  if (scan.lat == null || scan.lon == null) {
    await db.updateScan(sb, id, { status: "geocoding" });
    await db.logEvent(sb, id, `Locating "${scan.query}" on the map…`);
    // A user's own Google key is the last-resort geocoder if the free ones are busy.
    const owner = await loadUserConfig(scan.userId).catch(() => null);
    const googleKey = owner?.places?.provider === "google_places" ? owner.places.key : undefined;
    const geo = await geocode(scan.query, { googleKey, onNote: (m) => void db.logEvent(sb, id, m, "warn") });
    await db.updateScan(sb, id, {
      label: geo.label, lat: geo.lat, lon: geo.lon,
      countryCode: geo.countryCode ?? "", currency: market(geo.countryCode).currency,
    });
    await db.logEvent(sb, id, `Found ${geo.label} (${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)})`, "success");
    scan = (await db.getScan(sb, id))!;
  }

  if (scan.discovered === 0 && (await db.scanCounts(sb, id)).total === 0) {
    await db.updateScan(sb, id, { status: "discovering" });
    await db.logEvent(sb, id, `Scanning OpenStreetMap within ${(scan.radiusM / 1000).toFixed(1)} km for businesses…`);
    const { picked, found, chainsSkipped, institutionalSkipped } = await discover({
      lat: scan.lat!, lon: scan.lon!, radiusM: scan.radiusM, categories: scan.categories,
      max: scan.maxBusinesses, includeChains: scan.includeChains,
      onRetry: (m) => void db.logEvent(sb, id, m, "warn"),
    });
    if (!picked.length) throw new Error(`No matching businesses found within ${scan.radiusM / 1000} km. Try a bigger radius or more categories.`);
    await db.insertBusinesses(sb, id, picked);
    await db.updateScan(sb, id, { discovered: found });
    const skipped = [chainsSkipped && `${chainsSkipped} chain outlets`, institutionalSkipped && `${institutionalSkipped} institutional/public places`].filter(Boolean).join(", ");
    await db.logEvent(sb, id, `Found ${found} places${skipped ? ` (skipped ${skipped})` : ""}; selected ${picked.length} for deep analysis`, "success");
  }

  await db.updateScan(sb, id, { status: "analyzing" });
  // The scan owner's own providers and keys (decrypted in memory for this run only).
  const cfg = await loadUserConfig(scan.userId);
  await db.logEvent(sb, id, describeSetup(cfg, scan));

  const queue = await db.pendingBusinesses(sb, id);
  const workers = Array.from({ length: concurrency() }, async () => {
    while (queue.length && !draining()) {
      const b = queue.shift()!;
      const current = await db.getScan(sb, id);
      if (!current) return; // scan deleted mid-run
      await analyzeBusiness(b, current, cfg);
    }
  });
  await Promise.all(workers);

  // Shutting down: leave the scan unfinished so the next server picks it up.
  if (draining() && queue.length) return;
  if (!(await db.getScan(sb, id))) return;
  const counts = await db.scanCounts(sb, id);
  await db.updateScan(sb, id, { status: "done" });
  await db.logEvent(sb, id, `Done: ${counts.done} businesses analysed${counts.failed ? `, ${counts.failed} failed` : ""}`, "success");
}

async function contextFor(b: Business, scan: Scan): Promise<AnalysisContext> {
  const peers = (await db.listBusinesses(admin(), scan.id))
    .filter((p) => p.category === b.category && p.id !== b.id)
    .map((p) => ({ name: p.name, hasWebsite: Boolean(p.website) }));
  return {
    countryCode: scan.countryCode || null,
    currency: scan.currency,
    region: scan.label?.split(",")[0] ?? scan.query,
    peers,
  };
}

function describeSetup(cfg: UserConfig, scan: Scan): string {
  const parts: string[] = [];
  if (scan.aiMode !== "off" && cfg.llm) {
    parts.push(`${PROVIDERS[cfg.llm.provider].name} (${cfg.llm.model})`);
    if (scan.aiMode === "deep") {
      parts.push(cfg.research === "native" ? "its built-in web search" : cfg.search ? `${PROVIDERS[cfg.search.provider].name} search` : "no web search (add a search key for deep research)");
    }
  } else if (scan.aiMode !== "off") {
    parts.push("the built-in engine (add an AI key on your Profile page for AI analysis)");
  } else {
    parts.push("the built-in engine");
  }
  if (cfg.places) parts.push(`${PROVIDERS[cfg.places.provider].name} data`);
  return `Analysing with ${parts.join(" + ")}…`;
}

const describeAiError = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function analyzeBusiness(b: Business, scan: Scan, cfg: UserConfig) {
  const sb = admin();
  const log = (m: string, level: "info" | "success" | "warn" | "error" = "info") => db.logEvent(sb, scan.id, m, level, b.id);
  const reload = async () => (await db.getBusiness(sb, b.id))!;
  try {
    // 1. Crawl their website
    if (b.website && !b.crawl) {
      await db.updateBusiness(sb, b.id, { status: "crawling" });
      const crawl = await crawlSite(b.website);
      await db.updateBusiness(sb, b.id, {
        crawl,
        email: b.email ?? crawl.emails[0] ?? null,
        phone: b.phone ?? crawl.phones[0] ?? null,
      });
      await log(crawl.ok ? `Crawled ${b.name}: ${crawl.pagesCrawled.length} page(s), ${crawl.tech.slice(0, 2).join(", ") || "custom stack"}` : `${b.name}: website unreachable (${crawl.error})`, crawl.ok ? "info" : "warn");
    }

    // 2. Ratings & reviews from the user's business-data provider
    let biz = await reload();
    if (cfg.places && !biz.google) {
      await db.updateBusiness(sb, b.id, { status: "enriching" });
      try {
        const place = await enrichPlace(biz, cfg.places);
        if (place) {
          await db.updateBusiness(sb, b.id, { google: place, phone: biz.phone ?? place.phone ?? null });
          if (!biz.website && place.website) {
            await db.updateBusiness(sb, b.id, { website: place.website, crawl: await crawlSite(place.website) });
          }
        }
      } catch (e) {
        await log(`${PROVIDERS[cfg.places.provider].name} lookup failed for ${b.name}: ${describeAiError(e)}`, "warn");
      }
      biz = await reload();
    }

    // 3. Heuristic scoring - always runs, gives an instant baseline
    await db.updateBusiness(sb, b.id, { status: "scoring" });
    const ctx = await contextFor(biz, scan);
    let baseline = heuristicReport(biz, ctx);
    await db.updateBusiness(sb, b.id, { report: baseline, opportunity: baseline.scores.opportunity });

    // 4-5. AI research + synthesis
    if (cfg.llm && scan.aiMode !== "off") {
      try {
        let res = biz.research;
        if (scan.aiMode === "deep" && !res && cfg.research) {
          await db.updateBusiness(sb, b.id, { status: "researching" });
          await log(`Researching ${b.name} on the web…`);
          res = await research(biz, ctx, baseline, cfg, (m) => void log(m, "warn"));
        }
        if (res && !biz.research) {
          await db.updateBusiness(sb, b.id, { research: res });
          await log(`Research on ${b.name}: ${res.searches} searches, ${res.sources.length} sources`);

          // Map data often lacks websites/socials; adopt what the research found and audit it too.
          const found = res.found ?? {};
          const socials = { ...biz.socials };
          if (found.instagram && !socials.instagram) socials.instagram = found.instagram;
          if (found.facebook && !socials.facebook) socials.facebook = found.facebook;
          await db.updateBusiness(sb, b.id, { socials });
          if (found.website && !biz.website) {
            await log(`Found ${b.name}'s website via research: ${found.website}`);
            await db.updateBusiness(sb, b.id, { website: found.website, crawl: await crawlSite(found.website) });
          }
          biz = await reload();
          baseline = heuristicReport(biz, ctx);
          await db.updateBusiness(sb, b.id, { report: baseline, opportunity: baseline.scores.opportunity });
        }
        await db.updateBusiness(sb, b.id, { status: "writing" });
        const report = await writeReport(biz, ctx, baseline, res, cfg);
        await db.updateBusiness(sb, b.id, { report, opportunity: report.scores.opportunity });
      } catch (e) {
        await log(`AI analysis for ${b.name} failed, kept heuristic report: ${describeAiError(e)}`, "warn");
      }
    }

    const final = await reload();
    await db.updateBusiness(sb, b.id, { status: "done", error: null });
    await log(`${b.name} scored ${final.opportunity}/100`, (final.opportunity ?? 0) >= 70 ? "success" : "info");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.updateBusiness(sb, b.id, { status: "failed", error: msg }).catch(() => {});
    await log(`${b.name} failed: ${msg}`, "error");
  }
}

/**
 * Re-run analysis for a single business (e.g. after adding an API key).
 * The caller must already have verified that the user owns it.
 */
export async function reanalyze(businessId: string, opts: { fresh: boolean }) {
  const sb = admin();
  const b = await db.getBusiness(sb, businessId);
  if (!b) return false;
  const scan = await db.getScan(sb, b.scanId);
  if (!scan) return false;
  if (opts.fresh) await db.updateBusiness(sb, b.id, { crawl: null, google: null, research: null });
  await db.updateBusiness(sb, b.id, { status: "pending", error: null });
  const key = `biz:${b.id}`;
  if (running.has(key)) return true;
  running.add(key);
  const cfg = await loadUserConfig(scan.userId);
  analyzeBusiness((await db.getBusiness(sb, b.id))!, scan, cfg).finally(() => running.delete(key));
  return true;
}
