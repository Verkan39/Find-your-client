/**
 * Place name -> coordinates, resilient to rate limits.
 *
 * Nominatim (the official OpenStreetMap geocoder) allows ~1 request/second and
 * throttles shared cloud IPs, which hosting platforms use for outbound traffic.
 * So results are cached, Nominatim calls are spaced out, a 429 is retried once
 * after the delay it asks for, and if it still refuses we fall back to Photon
 * (keyless, also OpenStreetMap data) and finally to the user's own Google key.
 */

export interface GeoResult {
  label: string;
  lat: number;
  lon: number;
  countryCode: string | null;
  /** Which service answered (for logs). */
  source: "nominatim" | "photon" | "google";
}

const CONTACT = process.env.OSM_CONTACT_EMAIL || "";
const UA = `FindYourClient/0.1 (freelancer lead research${CONTACT ? `; ${CONTACT}` : ""})`;
const NOMINATIM = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const PHOTON = process.env.PHOTON_URL || "https://photon.komoot.io";

class GeoHttpError extends Error {
  constructor(public status: number, public retryAfter: number | null, service: string) {
    super(`${service} answered HTTP ${status}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------- caching -------------------------------- */

const g = globalThis as unknown as { __fycGeoCache?: Map<string, { at: number; value: GeoResult }>; __fycNominatimNext?: number };
const cache = (g.__fycGeoCache ??= new Map());
const CACHE_MS = 24 * 3600 * 1000;
const cacheKey = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

/* ------------------------------- Nominatim ------------------------------- */

/** Serialise calls so this server never exceeds ~1 request/second. */
async function nominatimSlot() {
  const now = Date.now();
  const at = Math.max(now, g.__fycNominatimNext ?? 0);
  g.__fycNominatimNext = at + 1100;
  if (at > now) await sleep(at - now);
}

async function nominatim(query: string): Promise<GeoResult | null> {
  await nominatimSlot();
  const url = new URL(`${NOMINATIM.replace(/\/$/, "")}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  if (CONTACT) url.searchParams.set("email", CONTACT); // identifies us, per the usage policy
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    const ra = Number(res.headers.get("retry-after"));
    throw new GeoHttpError(res.status, Number.isFinite(ra) && ra > 0 ? ra : null, "Nominatim");
  }
  const data = (await res.json()) as { display_name: string; lat: string; lon: string; address?: { country_code?: string } }[];
  const d = data[0];
  if (!d) return null;
  return {
    label: d.display_name.split(",").slice(0, 3).join(",").trim(),
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    countryCode: d.address?.country_code ?? null,
    source: "nominatim",
  };
}

/* -------------------------------- Photon -------------------------------- */

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; city?: string; district?: string; county?: string; state?: string; country?: string; countrycode?: string };
}

async function photon(query: string): Promise<GeoResult | null> {
  const url = new URL(`${PHOTON.replace(/\/$/, "")}/api/`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "en");
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new GeoHttpError(res.status, null, "Photon");
  const f = ((await res.json()) as { features?: PhotonFeature[] }).features?.[0];
  if (!f) return null;
  const p = f.properties;
  const parts = [p.name, p.district ?? p.city ?? p.county, p.state ?? p.country].filter((x, i, a) => x && a.indexOf(x) === i);
  return {
    label: parts.join(", "),
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    countryCode: p.countrycode?.toLowerCase() ?? null,
    source: "photon",
  };
}

/* -------------------------------- Google -------------------------------- */

async function google(query: string, key: string): Promise<GeoResult | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.location,places.formattedAddress,places.addressComponents",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new GeoHttpError(res.status, null, "Google");
  const p = ((await res.json()) as {
    places?: { location: { latitude: number; longitude: number }; formattedAddress?: string; addressComponents?: { shortText: string; types: string[] }[] }[];
  }).places?.[0];
  if (!p) return null;
  const country = p.addressComponents?.find((c) => c.types.includes("country"))?.shortText;
  return {
    label: (p.formattedAddress ?? query).split(",").slice(0, 3).join(",").trim(),
    lat: p.location.latitude,
    lon: p.location.longitude,
    countryCode: country?.toLowerCase() ?? null,
    source: "google",
  };
}

/* --------------------------------- main --------------------------------- */

export async function geocode(query: string, opts: { googleKey?: string; onNote?: (msg: string) => void } = {}): Promise<GeoResult> {
  const key = cacheKey(query);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const attempts: [string, () => Promise<GeoResult | null>][] = [
    ["Nominatim", async () => {
      try {
        return await nominatim(query);
      } catch (e) {
        // One polite retry when we're told to slow down (capped at 10 s).
        if (e instanceof GeoHttpError && e.status === 429) {
          await sleep(Math.min(10, e.retryAfter ?? 3) * 1000);
          return nominatim(query);
        }
        throw e;
      }
    }],
    ["Photon", () => photon(query)],
    ...(opts.googleKey ? [["Google", () => google(query, opts.googleKey!)] as [string, () => Promise<GeoResult | null>]] : []),
  ];

  const failures: string[] = [];
  let notFound = 0;
  for (const [name, run] of attempts) {
    try {
      const result = await run();
      if (result) {
        cache.set(key, { at: Date.now(), value: result });
        if (failures.length) opts.onNote?.(`Map lookup via ${name} (${failures.join("; ")})`);
        return result;
      }
      notFound++;
    } catch (e) {
      failures.push(e instanceof Error ? (e.name === "TimeoutError" ? `${name} timed out` : e.message) : String(e));
    }
  }

  if (notFound && !failures.length) {
    throw new Error(`Couldn't find a place called "${query}". Try adding the city or country.`);
  }
  if (notFound) {
    throw new Error(`Couldn't find "${query}" (some map services were also unavailable: ${failures.join("; ")}). Try adding the city or country, or retry in a minute.`);
  }
  throw new Error(`The map lookup services are busy right now (${failures.join("; ")}). Please retry in a minute.`);
}
