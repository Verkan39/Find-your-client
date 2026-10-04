import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  ActivityEvent,
  AiMode,
  Business,
  BusinessStatus,
  Scan,
  ScanCounts,
  ScanStatus,
} from "./types";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

const g = globalThis as unknown as { __fycDb?: DatabaseSync };

function open(): DatabaseSync {
  if (g.__fycDb) return g.__fycDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      label TEXT,
      lat REAL, lon REAL,
      radius_m INTEGER NOT NULL,
      country_code TEXT,
      currency TEXT NOT NULL DEFAULT 'USD',
      categories TEXT NOT NULL,
      max_businesses INTEGER NOT NULL,
      include_chains INTEGER NOT NULL DEFAULT 0,
      ai_mode TEXT NOT NULL DEFAULT 'deep',
      status TEXT NOT NULL,
      error TEXT,
      discovered INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      osm_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      category_label TEXT NOT NULL,
      grp TEXT NOT NULL,
      lat REAL NOT NULL, lon REAL NOT NULL,
      address TEXT, phone TEXT, website TEXT, email TEXT, opening_hours TEXT, brand TEXT,
      tags TEXT NOT NULL,
      socials TEXT NOT NULL,
      crawl TEXT, google TEXT, report TEXT, research TEXT,
      status TEXT NOT NULL,
      error TEXT,
      opportunity INTEGER,
      updated_at INTEGER NOT NULL,
      UNIQUE (scan_id, osm_id)
    );
    CREATE INDEX IF NOT EXISTS idx_biz_scan ON businesses(scan_id);
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      business_id TEXT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_scan ON events(scan_id, id);
  `);
  g.__fycDb = db;
  return db;
}

export const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

type Row = Record<string, unknown>;

const json = <T>(v: unknown, fallback: T): T => {
  if (typeof v !== "string" || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

function toScan(r: Row): Scan {
  return {
    id: r.id as string,
    query: r.query as string,
    label: (r.label as string) ?? null,
    lat: (r.lat as number) ?? null,
    lon: (r.lon as number) ?? null,
    radiusM: r.radius_m as number,
    countryCode: (r.country_code as string) ?? null,
    currency: r.currency as string,
    categories: json<string[]>(r.categories, []),
    maxBusinesses: r.max_businesses as number,
    includeChains: Boolean(r.include_chains),
    aiMode: r.ai_mode as AiMode,
    status: r.status as ScanStatus,
    error: (r.error as string) ?? null,
    discovered: r.discovered as number,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
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
    tags: json(r.tags, {}),
    socials: json(r.socials, {}),
    crawl: json(r.crawl, null),
    google: json(r.google, null),
    report: json(r.report, null),
    research: json(r.research, null),
    status: r.status as BusinessStatus,
    error: (r.error as string) ?? null,
    opportunity: (r.opportunity as number) ?? null,
    updatedAt: r.updated_at as number,
  };
}

/* ----------------------------- scans ----------------------------- */

export function createScan(input: {
  query: string;
  radiusM: number;
  categories: string[];
  maxBusinesses: number;
  includeChains: boolean;
  aiMode: AiMode;
}): Scan {
  const id = newId();
  const now = Date.now();
  open()
    .prepare(
      `INSERT INTO scans (id, query, radius_m, categories, max_businesses, include_chains, ai_mode, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
    )
    .run(id, input.query, input.radiusM, JSON.stringify(input.categories), input.maxBusinesses, input.includeChains ? 1 : 0, input.aiMode, now, now);
  return getScan(id)!;
}

export function getScan(id: string): Scan | null {
  const r = open().prepare(`SELECT * FROM scans WHERE id = ?`).get(id) as Row | undefined;
  return r ? toScan(r) : null;
}

export function listScans(): (Scan & { counts: ScanCounts; topOpportunity: number | null })[] {
  const rows = open().prepare(`SELECT * FROM scans ORDER BY created_at DESC`).all() as Row[];
  return rows.map((r) => {
    const s = toScan(r);
    const top = open()
      .prepare(`SELECT MAX(opportunity) AS m FROM businesses WHERE scan_id = ?`)
      .get(s.id) as { m: number | null };
    return { ...s, counts: scanCounts(s.id), topOpportunity: top.m };
  });
}

export function updateScan(id: string, patch: Partial<{
  label: string; lat: number; lon: number; countryCode: string; currency: string;
  status: ScanStatus; error: string | null; discovered: number;
}>) {
  const map: Record<string, string> = {
    label: "label", lat: "lat", lon: "lon", countryCode: "country_code", currency: "currency",
    status: "status", error: "error", discovered: "discovered",
  };
  const keys = Object.keys(patch).filter((k) => k in map);
  if (!keys.length) return;
  const sets = keys.map((k) => `${map[k]} = ?`).join(", ");
  const vals = keys.map((k) => (patch as Record<string, string | number | null>)[k]);
  open().prepare(`UPDATE scans SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals, Date.now(), id);
}

export function deleteScan(id: string) {
  open().prepare(`DELETE FROM scans WHERE id = ?`).run(id);
}

export function scanCounts(scanId: string): ScanCounts {
  const r = open()
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(status = 'done') AS done,
              SUM(status = 'failed') AS failed
       FROM businesses WHERE scan_id = ?`,
    )
    .get(scanId) as { total: number; done: number | null; failed: number | null };
  const done = r.done ?? 0;
  const failed = r.failed ?? 0;
  return { total: r.total, done, failed, inProgress: r.total - done - failed };
}

export function unfinishedScans(): Scan[] {
  return (open()
    .prepare(`SELECT * FROM scans WHERE status NOT IN ('done', 'failed') ORDER BY created_at`)
    .all() as Row[]).map(toScan);
}

/* --------------------------- businesses -------------------------- */

export function insertBusinesses(scanId: string, list: Omit<Business, "id" | "scanId" | "crawl" | "google" | "report" | "research" | "status" | "error" | "opportunity" | "updatedAt">[]) {
  const db = open();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO businesses
      (id, scan_id, osm_id, name, category, category_label, grp, lat, lon, address, phone, website, email, opening_hours, brand, tags, socials, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  );
  const now = Date.now();
  db.exec("BEGIN");
  try {
    for (const b of list) {
      stmt.run(newId(), scanId, b.osmId, b.name, b.category, b.categoryLabel, b.group, b.lat, b.lon,
        b.address, b.phone, b.website, b.email, b.openingHours, b.brand, JSON.stringify(b.tags), JSON.stringify(b.socials), now);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function getBusiness(id: string): Business | null {
  const r = open().prepare(`SELECT * FROM businesses WHERE id = ?`).get(id) as Row | undefined;
  return r ? toBusiness(r) : null;
}

export function listBusinesses(scanId: string): Business[] {
  return (open()
    .prepare(`SELECT * FROM businesses WHERE scan_id = ? ORDER BY opportunity IS NULL, opportunity DESC, name`)
    .all(scanId) as Row[]).map(toBusiness);
}

export function pendingBusinesses(scanId: string): Business[] {
  return (open()
    .prepare(`SELECT * FROM businesses WHERE scan_id = ? AND status NOT IN ('done', 'failed') ORDER BY rowid`)
    .all(scanId) as Row[]).map(toBusiness);
}

export function updateBusiness(id: string, patch: Partial<Pick<Business,
  "crawl" | "google" | "report" | "research" | "status" | "error" | "opportunity" | "socials" | "website" | "phone" | "email">>) {
  const cols: Record<string, (v: unknown) => unknown> = {
    crawl: (v) => (v == null ? null : JSON.stringify(v)),
    google: (v) => (v == null ? null : JSON.stringify(v)),
    report: (v) => (v == null ? null : JSON.stringify(v)),
    research: (v) => (v == null ? null : JSON.stringify(v)),
    socials: (v) => JSON.stringify(v ?? {}),
    status: (v) => v,
    error: (v) => v,
    opportunity: (v) => v,
    website: (v) => v,
    phone: (v) => v,
    email: (v) => v,
  };
  const keys = Object.keys(patch).filter((k) => k in cols);
  if (!keys.length) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const vals = keys.map((k) => cols[k]((patch as Record<string, unknown>)[k])) as (string | number | null)[];
  open().prepare(`UPDATE businesses SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals, Date.now(), id);
}

/* ----------------------------- events ---------------------------- */

export function logEvent(scanId: string, message: string, level: ActivityEvent["level"] = "info", businessId: string | null = null) {
  open()
    .prepare(`INSERT INTO events (scan_id, business_id, level, message, ts) VALUES (?, ?, ?, ?, ?)`)
    .run(scanId, businessId, level, message, Date.now());
}

export function recentEvents(scanId: string, limit = 40): ActivityEvent[] {
  return (open()
    .prepare(`SELECT * FROM events WHERE scan_id = ? ORDER BY id DESC LIMIT ?`)
    .all(scanId, limit) as Row[]).map((r) => ({
    id: r.id as number,
    scanId: r.scan_id as string,
    businessId: (r.business_id as string) ?? null,
    level: r.level as ActivityEvent["level"],
    message: r.message as string,
    ts: r.ts as number,
  }));
}
