import { CATEGORIES, CATEGORY_BY_KEY, matchCategory, type CategoryDef } from "./categories";
import type { Business, Socials } from "./types";

const UA = `FindYourClient/0.1 (freelancer lead research; ${process.env.OSM_CONTACT_EMAIL || "contact-not-set"})`;

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export { geocode, type GeoResult } from "./geocode";

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** One regex selector per tag key keeps the query light enough for busy public servers. */
function buildQuery(cats: CategoryDef[], lat: number, lon: number, radiusM: number) {
  const byKey = new Map<string, Set<string>>();
  for (const c of cats) {
    for (const m of c.osm) {
      const [k, v] = m.split("=");
      if (!byKey.has(k)) byKey.set(k, new Set());
      byKey.get(k)!.add(v);
    }
  }
  const around = `(around:${radiusM},${lat},${lon})`;
  const parts = [...byKey].map(([k, vals]) => `nwr["${k}"~"^(${[...vals].join("|")})$"]["name"]${around};`);
  return `[out:json][timeout:90];(${parts.join("")});out center tags 3000;`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Public Overpass servers are often overloaded; rotate mirrors over a few rounds with backoff. */
async function overpass(query: string, onRetry?: (msg: string) => void): Promise<OsmElement[]> {
  let lastErr = "";
  for (let round = 0; round < 3; round++) {
    for (const endpoint of OVERPASS) {
      const host = new URL(endpoint).hostname;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(query),
          signal: AbortSignal.timeout(100_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { elements?: OsmElement[]; remark?: string };
        if (!data.elements?.length && data.remark) throw new Error(data.remark.slice(0, 120));
        return data.elements ?? [];
      } catch (e) {
        lastErr = `${host}: ${e instanceof Error ? (e.name === "TimeoutError" ? "timed out" : e.message) : String(e)}`;
        onRetry?.(`Map server busy (${lastErr}), trying another…`);
      }
    }
    await sleep(8_000 * (round + 1));
  }
  throw new Error(`OpenStreetMap servers are overloaded right now (${lastErr}). Try again in a few minutes.`);
}

const SOCIAL_TAGS: Record<keyof Socials, string[]> = {
  instagram: ["contact:instagram", "instagram"],
  facebook: ["contact:facebook", "facebook"],
  linkedin: ["contact:linkedin"],
  youtube: ["contact:youtube"],
  tiktok: ["contact:tiktok"],
  x: ["contact:twitter", "twitter", "contact:x"],
  whatsapp: ["contact:whatsapp"],
  pinterest: ["contact:pinterest"],
};

function normalizeUrl(u: string | undefined): string | null {
  if (!u) return null;
  let s = u.split(";")[0].trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  try {
    return new URL(s).toString();
  } catch {
    return null;
  }
}

function addressOf(t: Record<string, string>): string | null {
  const line1 = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const parts = [t["addr:full"] || line1, t["addr:suburb"] || t["addr:neighbourhood"], t["addr:city"], t["addr:postcode"]].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

const INSTITUTIONAL_OPERATOR = /\b(IIT|IIM|NIT|AIIMS|universit(y|é)|institute|college|school|academy of|government|govt|municipal|council|corporation of|ministry|army|navy|air force|railways?|police|hospital trust|church|temple|mosque|gurudwara)\b/i;
const INSTITUTIONAL_NAME = /\b(department|dept\.?|faculty|universit(y|é)|institute of|campus|hall of residence|sports ground|playground|stadium|government|govt\.?|municipal|police|post office|panchayat|cantonment)\b/i;
const MEMBERS_ONLY = /\b(residents|students only|staff only|members only|employees only|for the residents|internal use)\b/i;

/** Map data mixes in campus canteens, public facilities and departments; none of them hire freelancers. */
function isInstitutional(tags: Record<string, string>, name: string) {
  if (tags.access === "private" || tags.access === "no") return true;
  if (["public", "government", "community", "religious", "military"].includes(tags["operator:type"] ?? "")) return true;
  if (tags.operator && INSTITUTIONAL_OPERATOR.test(tags.operator)) return true;
  if (INSTITUTIONAL_NAME.test(name)) return true;
  if (tags.description && MEMBERS_ONLY.test(tags.description)) return true;
  return false;
}

export type DiscoveredBusiness = Omit<Business, "id" | "scanId" | "crawl" | "google" | "report" | "research" | "status" | "error" | "opportunity" | "updatedAt">;

/**
 * Find candidate businesses around a point and pick the most promising, diverse set.
 * Chains are excluded by default: their marketing is decided at head office, so a
 * freelancer pitching the local branch rarely gets anywhere.
 */
export async function discover(opts: {
  lat: number;
  lon: number;
  radiusM: number;
  categories: string[];
  max: number;
  includeChains: boolean;
  onRetry?: (msg: string) => void;
}): Promise<{ picked: DiscoveredBusiness[]; found: number; chainsSkipped: number; institutionalSkipped: number }> {
  const cats = opts.categories.length
    ? opts.categories.map((k) => CATEGORY_BY_KEY[k]).filter(Boolean)
    : CATEGORIES;
  const elements = await overpass(buildQuery(cats, opts.lat, opts.lon, opts.radiusM), opts.onRetry);

  const nameCounts = new Map<string, number>();
  for (const e of elements) {
    const n = e.tags?.name?.toLowerCase().trim();
    if (n) nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const candidates: (DiscoveredBusiness & { pre: number })[] = [];
  let chainsSkipped = 0;
  let institutionalSkipped = 0;

  for (const e of elements) {
    const tags = e.tags ?? {};
    const name = tags.name?.trim();
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!name || lat == null || lon == null) continue;
    if (tags.disused || tags["disused:shop"] || tags.abandoned) continue;
    const cat = matchCategory(tags);
    if (!cat || !cats.includes(cat)) continue;
    if (isInstitutional(tags, name)) {
      institutionalSkipped++;
      continue;
    }

    const dedupe = `${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const isChain = Boolean(tags.brand || tags["brand:wikidata"]) || (nameCounts.get(name.toLowerCase()) ?? 0) >= 3;
    if (isChain && !opts.includeChains) {
      chainsSkipped++;
      continue;
    }

    const socials: Socials = {};
    for (const [k, keys] of Object.entries(SOCIAL_TAGS) as [keyof Socials, string[]][]) {
      const v = keys.map((x) => tags[x]).find(Boolean);
      if (v) socials[k] = v.startsWith("http") ? v : v.replace(/^@/, "");
    }

    const website = normalizeUrl(tags.website || tags["contact:website"] || tags.url);
    const first = (v?: string) => v?.split(";")[0].trim() || null;
    const phone = first(tags.phone || tags["contact:phone"] || tags["contact:mobile"]);
    const email = first(tags.email || tags["contact:email"]);

    let pre = 0;
    if (website) pre += 2;
    if (phone) pre += 1.5;
    if (email) pre += 1;
    if (Object.keys(socials).length) pre += 1;
    if (tags.opening_hours) pre += 0.5;
    if (addressOf(tags)) pre += 0.5;
    pre += cat.spendPropensity * 2;
    const reachable = Boolean(website || phone || email || Object.keys(socials).length);
    if (!reachable) pre -= 3;
    pre += Math.random() * 0.5;

    candidates.push({
      osmId: `${e.type}/${e.id}`,
      name,
      category: cat.key,
      categoryLabel: cat.label,
      group: cat.group,
      lat, lon,
      address: addressOf(tags),
      phone,
      website,
      email,
      openingHours: tags.opening_hours ?? null,
      brand: isChain ? (tags.brand || name) : null,
      tags,
      socials,
      pre,
    });
  }

  // Round-robin across categories so one dense category doesn't crowd out the rest.
  const byCat = new Map<string, typeof candidates>();
  for (const c of candidates) {
    if (!byCat.has(c.category)) byCat.set(c.category, []);
    byCat.get(c.category)!.push(c);
  }
  for (const list of byCat.values()) list.sort((a, b) => b.pre - a.pre);
  const queues = [...byCat.values()].sort((a, b) => b[0].pre - a[0].pre);
  const picked: DiscoveredBusiness[] = [];
  while (picked.length < opts.max && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        const { pre: _pre, ...rest } = next;
        picked.push(rest);
        if (picked.length >= opts.max) break;
      }
    }
  }

  return { picked, found: candidates.length + chainsSkipped + institutionalSkipped, chainsSkipped, institutionalSkipped };
}
