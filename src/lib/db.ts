import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityEvent,
  AiMode,
  Business,
  BusinessStatus,
  PeerStats,
  Scan,
  ScanCounts,
  ScanStatus,
} from "./types";

/**
 * Data access over Supabase. Every function takes the client to use:
 *  - API routes pass the signed-in user's client, so row-level security limits
 *    them to that user's rows;
 *  - the background pipeline passes the admin client (see supabase/admin.ts).
 */
type DB = SupabaseClient;
type Row = Record<string, unknown>;

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Database error while ${what}: ${res.error.message}`);
  return res.data;
}

const ms = (v: unknown) => (typeof v === "string" ? Date.parse(v) : Number(v));

function toScan(r: Row): Scan {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    query: r.query as string,
    label: (r.label as string) ?? null,
    lat: (r.lat as number) ?? null,
    lon: (r.lon as number) ?? null,
    radiusM: r.radius_m as number,
    countryCode: (r.country_code as string) ?? null,
    currency: r.currency as string,
    categories: (r.categories as string[]) ?? [],
    maxBusinesses: r.max_businesses as number,
    includeChains: Boolean(r.include_chains),
    aiMode: r.ai_mode as AiMode,
    status: r.status as ScanStatus,
    error: (r.error as string) ?? null,
    discovered: r.discovered as number,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
  };
}

function toBusiness(r: Row): Business {
  return {
    id: r.id as string,
    scanId: r.scan_id as string,
    osmId: r.osm_id as string,
    name: r.name as string,
    category: r.category as string,
    categoryLabel: r.category_label as string,
    group: r.grp as string,
    lat: r.lat as number,
    lon: r.lon as number,
    address: (r.address as string) ?? null,
    phone: (r.phone as string) ?? null,
    website: (r.website as string) ?? null,
    email: (r.email as string) ?? null,
    openingHours: (r.opening_hours as string) ?? null,
    brand: (r.brand as string) ?? null,
    tags: (r.tags as Record<string, string>) ?? {},
    socials: (r.socials as Business["socials"]) ?? {},
    crawl: (r.crawl as Business["crawl"]) ?? null,
    google: (r.google as Business["google"]) ?? null,
    report: (r.report as Business["report"]) ?? null,
    research: (r.research as Business["research"]) ?? null,
    status: r.status as BusinessStatus,
    error: (r.error as string) ?? null,
    opportunity: (r.opportunity as number) ?? null,
    updatedAt: ms(r.updated_at),
  };
}

/* ----------------------------- scans ----------------------------- */

/** Scans are created by the server (admin client) after the API route has validated limits. */
export async function createScan(db: DB, userId: string, input: {
  query: string;
  radiusM: number;
  categories: string[];
  maxBusinesses: number;
  includeChains: boolean;
  aiMode: AiMode;
}): Promise<Scan> {
  const data = check(
    await db
      .from("scans")
      .insert({
        user_id: userId,
        query: input.query,
        radius_m: input.radiusM,
        categories: input.categories,
        max_businesses: input.maxBusinesses,
        include_chains: input.includeChains,
        ai_mode: input.aiMode,
      })
      .select()
      .single(),
    "creating the scan",
  );
  return toScan(data as Row);
}

export async function getScan(db: DB, id: string): Promise<Scan | null> {
  const data = check(await db.from("scans").select().eq("id", id).maybeSingle(), "loading the scan");
  return data ? toScan(data as Row) : null;
}

export async function listScans(db: DB): Promise<(Scan & { counts: ScanCounts; topOpportunity: number | null })[]> {
  const rows = check(
    await db.from("scan_overview").select().order("created_at", { ascending: false }),
    "listing scans",
  ) as Row[];
  return rows.map((r) => {
    const total = (r.total as number) ?? 0;
    const done = (r.done as number) ?? 0;
    const failed = (r.failed as number) ?? 0;
    return {
      ...toScan(r),
      counts: { total, done, failed, inProgress: total - done - failed },
      topOpportunity: (r.top_opportunity as number) ?? null,
    };
  });
}

export async function updateScan(db: DB, id: string, patch: Partial<{
  label: string; lat: number; lon: number; countryCode: string; currency: string;
  status: ScanStatus; error: string | null; discovered: number;
}>) {
  const map: Record<string, string> = {
    label: "label", lat: "lat", lon: "lon", countryCode: "country_code", currency: "currency",
    status: "status", error: "error", discovered: "discovered",
  };
  const row: Row = {};
  for (const [k, v] of Object.entries(patch)) if (k in map) row[map[k]] = v;
  if (!Object.keys(row).length) return;
  check(await db.from("scans").update(row).eq("id", id), "updating the scan");
}

export async function deleteScan(db: DB, id: string) {
  check(await db.from("scans").delete().eq("id", id), "deleting the scan");
}

export async function scanCounts(db: DB, scanId: string): Promise<ScanCounts> {
  const rows = check(await db.from("businesses").select("status").eq("scan_id", scanId), "counting businesses") as { status: string }[];
  const done = rows.filter((r) => r.status === "done").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  return { total: rows.length, done, failed, inProgress: rows.length - done - failed };
}

export async function unfinishedScans(db: DB): Promise<Scan[]> {
  const rows = check(
    await db.from("scans").select().not("status", "in", "(done,failed)").order("created_at"),
    "loading unfinished scans",
  ) as Row[];
  return rows.map(toScan);
}

/** Businesses requested by the caller's scans in the last 24 hours (for the daily limit). */
export async function businessesRequestedToday(db: DB): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const rows = check(
    await db.from("scans").select("max_businesses").gte("created_at", since),
    "checking usage",
  ) as { max_businesses: number }[];
  return rows.reduce((s, r) => s + r.max_businesses, 0);
}

/* --------------------------- businesses -------------------------- */

export async function insertBusinesses(db: DB, scanId: string, list: Omit<Business, "id" | "scanId" | "crawl" | "google" | "report" | "research" | "status" | "error" | "opportunity" | "updatedAt">[]) {
  if (!list.length) return;
  check(
    await db.from("businesses").upsert(
      list.map((b) => ({
        scan_id: scanId,
        osm_id: b.osmId,
        name: b.name,
        category: b.category,
        category_label: b.categoryLabel,
        grp: b.group,
        lat: b.lat,
        lon: b.lon,
        address: b.address,
        phone: b.phone,
        website: b.website,
        email: b.email,
        opening_hours: b.openingHours,
        brand: b.brand,
        tags: b.tags,
        socials: b.socials,
      })),
      { onConflict: "scan_id,osm_id", ignoreDuplicates: true },
    ),
    "saving discovered businesses",
  );
}

export async function getBusiness(db: DB, id: string): Promise<Business | null> {
  const data = check(await db.from("businesses").select().eq("id", id).maybeSingle(), "loading the business");
  return data ? toBusiness(data as Row) : null;
}

export async function listBusinesses(db: DB, scanId: string): Promise<Business[]> {
  const rows = check(
    await db.from("businesses").select().eq("scan_id", scanId)
      .order("opportunity", { ascending: false, nullsFirst: false }).order("name"),
    "listing businesses",
  ) as Row[];
  return rows.map(toBusiness);
}

export async function pendingBusinesses(db: DB, scanId: string): Promise<Business[]> {
  const rows = check(
    await db.from("businesses").select().eq("scan_id", scanId).not("status", "in", "(done,failed)").order("created_at"),
    "loading pending businesses",
  ) as Row[];
  return rows.map(toBusiness);
}

export async function peerStats(db: DB, b: Business): Promise<PeerStats> {
  const rows = check(
    await db.from("businesses").select("website").eq("scan_id", b.scanId).eq("category", b.category).neq("id", b.id),
    "loading competitors",
  ) as { website: string | null }[];
  return { total: rows.length, withWebsite: rows.filter((r) => r.website).length };
}

export async function updateBusiness(db: DB, id: string, patch: Partial<Pick<Business,
  "crawl" | "google" | "report" | "research" | "status" | "error" | "opportunity" | "socials" | "website" | "phone" | "email">>) {
  if (!Object.keys(patch).length) return;
  check(await db.from("businesses").update(patch).eq("id", id), "updating the business");
}

/* ----------------------------- events ---------------------------- */

export async function logEvent(db: DB, scanId: string, message: string, level: ActivityEvent["level"] = "info", businessId: string | null = null) {
  // The activity feed is best-effort; never let it break the pipeline.
  const { error } = await db.from("scan_events").insert({ scan_id: scanId, business_id: businessId, level, message });
  if (error) console.warn(`[events] ${error.message}`);
}

export async function recentEvents(db: DB, scanId: string, limit = 40): Promise<ActivityEvent[]> {
  const rows = check(
    await db.from("scan_events").select().eq("scan_id", scanId).order("id", { ascending: false }).limit(limit),
    "loading activity",
  ) as Row[];
  return rows.map((r) => ({
    id: r.id as number,
    scanId: r.scan_id as string,
    businessId: (r.business_id as string) ?? null,
    level: r.level as ActivityEvent["level"],
    message: r.message as string,
    ts: ms(r.created_at),
  }));
}
