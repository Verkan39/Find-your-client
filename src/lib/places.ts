import type { PlacesProvider } from "./providers/catalog";
import { requestJson } from "./providers/http";
import type { Business, GoogleData } from "./types";

/**
 * Business-data enrichment: match a business found on OpenStreetMap against the
 * user's chosen provider for ratings, review volume, price level and review text.
 */
export interface PlacesConfig {
  provider: PlacesProvider;
  key: string;
}

export async function enrichPlace(b: Business, cfg: PlacesConfig): Promise<GoogleData | null> {
  return cfg.provider === "yelp" ? yelp(b, cfg.key) : googlePlaces(b, cfg.key);
}

export const placesSourceName = (g: Pick<GoogleData, "source"> | null | undefined) => (g?.source === "yelp" ? "Yelp" : "Google");

/* ------------------------------ Google Places ------------------------------ */

const GOOGLE_FIELDS = [
  "places.id", "places.displayName", "places.rating", "places.userRatingCount", "places.priceLevel",
  "places.websiteUri", "places.nationalPhoneNumber", "places.googleMapsUri", "places.businessStatus",
  "places.primaryTypeDisplayName", "places.types", "places.regularOpeningHours.weekdayDescriptions", "places.reviews",
].join(",");

interface GooglePlacesResponse {
  places?: {
    id: string;
    displayName?: { text: string };
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    googleMapsUri?: string;
    businessStatus?: string;
    primaryTypeDisplayName?: { text: string };
    types?: string[];
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    reviews?: { rating: number; text?: { text: string }; relativePublishTimeDescription?: string }[];
  }[];
}

function googleSearch(key: string, body: Record<string, unknown>, fields = GOOGLE_FIELDS) {
  return requestJson<GooglePlacesResponse>("google_places", "https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields },
    body: JSON.stringify(body),
    timeoutMs: 15_000,
  });
}

async function googlePlaces(b: Business, key: string): Promise<GoogleData | null> {
  const res = await googleSearch(key, {
    textQuery: [b.name, b.address].filter(Boolean).join(", "),
    locationBias: { circle: { center: { latitude: b.lat, longitude: b.lon }, radius: 300 } },
    maxResultCount: 1,
  });
  const p = res.places?.[0];
  if (!p) return null;
  return {
    source: "google",
    placeId: p.id,
    name: p.displayName?.text ?? b.name,
    rating: p.rating,
    reviewCount: p.userRatingCount,
    priceLevel: p.priceLevel?.replace("PRICE_LEVEL_", "").toLowerCase(),
    website: p.websiteUri,
    phone: p.nationalPhoneNumber,
    mapsUrl: p.googleMapsUri,
    businessStatus: p.businessStatus,
    primaryType: p.primaryTypeDisplayName?.text,
    types: p.types ?? [],
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    reviews: (p.reviews ?? []).map((r) => ({ rating: r.rating, text: r.text?.text?.slice(0, 600) ?? "", when: r.relativePublishTimeDescription })),
  };
}

/* ---------------------------------- Yelp ---------------------------------- */

interface YelpBusiness {
  id: string;
  name: string;
  url?: string;
  rating?: number;
  review_count?: number;
  price?: string;
  display_phone?: string;
  is_closed?: boolean;
  categories?: { alias: string; title: string }[];
}

const YELP = "https://api.yelp.com/v3";
const yelpHeaders = (key: string) => ({ Authorization: `Bearer ${key}`, Accept: "application/json" });
const YELP_PRICE: Record<string, string> = { $: "inexpensive", $$: "moderate", $$$: "expensive", $$$$: "very_expensive" };

async function yelp(b: Business, key: string): Promise<GoogleData | null> {
  const q = new URLSearchParams({ term: b.name, latitude: String(b.lat), longitude: String(b.lon), radius: "400", limit: "3" });
  const res = await requestJson<{ businesses?: YelpBusiness[] }>("yelp", `${YELP}/businesses/search?${q}`, { headers: yelpHeaders(key), timeoutMs: 15_000 });
  // Yelp's search is fuzzy: require the names to actually resemble each other.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = norm(b.name);
  const p = res.businesses?.find((x) => norm(x.name).includes(want.slice(0, 6)) || want.includes(norm(x.name).slice(0, 6)));
  if (!p) return null;

  let reviews: GoogleData["reviews"] = [];
  try {
    const r = await requestJson<{ reviews?: { rating: number; text: string; time_created?: string }[] }>(
      "yelp", `${YELP}/businesses/${encodeURIComponent(p.id)}/reviews?limit=3&sort_by=newest`, { headers: yelpHeaders(key), timeoutMs: 15_000 },
    );
    reviews = (r.reviews ?? []).map((x) => ({ rating: x.rating, text: x.text.slice(0, 600), when: x.time_created?.slice(0, 10) }));
  } catch {
    // Review excerpts aren't available on every Yelp plan; ratings are enough.
  }

  return {
    source: "yelp",
    placeId: p.id,
    name: p.name,
    rating: p.rating,
    reviewCount: p.review_count,
    priceLevel: p.price ? YELP_PRICE[p.price] : undefined,
    phone: p.display_phone || undefined,
    mapsUrl: p.url,
    businessStatus: p.is_closed ? "CLOSED_PERMANENTLY" : "OPERATIONAL",
    primaryType: p.categories?.[0]?.title,
    types: (p.categories ?? []).map((c) => c.alias),
    hours: [],
    reviews,
  };
}

/** Cheap call that succeeds only with a valid key. */
export async function validatePlacesKey(provider: PlacesProvider, key: string) {
  if (provider === "yelp") {
    await requestJson("yelp", `${YELP}/businesses/search?term=coffee&location=New%20York&limit=1`, { headers: yelpHeaders(key), timeoutMs: 15_000 });
  } else {
    await googleSearch(key, { textQuery: "coffee", maxResultCount: 1 }, "places.id");
  }
}
