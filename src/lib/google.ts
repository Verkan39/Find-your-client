import type { Business, GoogleData } from "./types";

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.reviews",
].join(",");

export const googleEnabled = () => Boolean(process.env.GOOGLE_PLACES_API_KEY);

interface PlacesResponse {
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

/** Match the business on Google Maps (Places API New) for ratings, review volume and review text. */
export async function enrichFromGoogle(b: Business): Promise<GoogleData | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELDS,
    },
    body: JSON.stringify({
      textQuery: [b.name, b.address].filter(Boolean).join(", "),
      locationBias: { circle: { center: { latitude: b.lat, longitude: b.lon }, radius: 300 } },
      maxResultCount: 1,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const p = ((await res.json()) as PlacesResponse).places?.[0];
  if (!p) return null;
  return {
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
    reviews: (p.reviews ?? []).map((r) => ({
      rating: r.rating,
      text: r.text?.text?.slice(0, 600) ?? "",
      when: r.relativePublishTimeDescription,
    })),
  };
}
