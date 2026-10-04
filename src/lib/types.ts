import { z } from "zod";

export type AiMode = "deep" | "standard" | "off";
export type ScanStatus = "queued" | "geocoding" | "discovering" | "analyzing" | "done" | "failed";
export type BusinessStatus =
  | "pending"
  | "crawling"
  | "enriching"
  | "scoring"
  | "researching"
  | "writing"
  | "done"
  | "failed";

export interface Scan {
  id: string;
  query: string;
  label: string | null;
  lat: number | null;
  lon: number | null;
  radiusM: number;
  countryCode: string | null;
  currency: string;
  categories: string[];
  maxBusinesses: number;
  includeChains: boolean;
  aiMode: AiMode;
  status: ScanStatus;
  error: string | null;
  discovered: number;
  createdAt: number;
  updatedAt: number;
}

export interface ScanCounts {
  total: number;
  done: number;
  failed: number;
  inProgress: number;
}

export interface Socials {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  x?: string;
  whatsapp?: string;
  pinterest?: string;
}

/** Everything learned from crawling the business's own website. */
export interface CrawlResult {
  ok: boolean;
  error?: string;
  requestedUrl: string;
  finalUrl?: string;
  status?: number;
  https: boolean;
  loadMs?: number;
  htmlBytes?: number;
  pagesCrawled: string[];
  title?: string;
  metaDescription?: string;
  hasViewport: boolean;
  hasOpenGraph: boolean;
  jsonLdTypes: string[];
  tech: string[];
  analytics: string[];
  booking: string[];
  ecommerce: string[];
  chat: string[];
  socials: Socials;
  emails: string[];
  phones: string[];
  copyrightYear?: number;
  hasContactForm: boolean;
  imagesWithoutAlt: number;
  imagesTotal: number;
  wordCount: number;
  language?: string;
  textSample: string;
  pageHeadings: string[];
}

export interface GoogleData {
  placeId: string;
  name: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
  website?: string;
  phone?: string;
  mapsUrl?: string;
  businessStatus?: string;
  primaryType?: string;
  types: string[];
  hours: string[];
  reviews: { rating: number; text: string; when?: string }[];
}

export interface Business {
  id: string;
  scanId: string;
  osmId: string;
  name: string;
  category: string;
  categoryLabel: string;
  group: string;
  lat: number;
  lon: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  openingHours: string | null;
  brand: string | null;
  tags: Record<string, string>;
  socials: Socials;
  crawl: CrawlResult | null;
  google: GoogleData | null;
  report: Report | null;
  research: Research | null;
  status: BusinessStatus;
  error: string | null;
  opportunity: number | null;
  updatedAt: number;
}

export interface Research {
  notes: string;
  sources: { title: string; url: string }[];
  searches: number;
  /** Official links the research turned up, used to fill gaps in the map data. */
  found?: { website?: string; instagram?: string; facebook?: string };
}

export interface ActivityEvent {
  id: number;
  scanId: string;
  businessId: string | null;
  level: "info" | "success" | "warn" | "error";
  message: string;
  ts: number;
}

/* ------------------------------------------------------------------ */
/* Report schema: produced by the heuristic engine and, when an API    */
/* key is configured, rewritten in depth by Claude. The UI renders     */
/* exactly this shape regardless of source.                            */
/* ------------------------------------------------------------------ */

const Score = (what = "Integer score from 0 to 100") => z.number().describe(what);

export const ReportSchema = z.object({
  summary: z.string().describe("3-5 sentence executive summary of the business and the opportunity for a freelance developer"),
  profile: z.object({
    whatTheyDo: z.string(),
    size: z.enum(["micro", "small", "medium", "large"]),
    employeesEstimate: z.string().describe("e.g. '3-6 staff'"),
    priceTier: z.enum(["budget", "mid", "premium", "luxury"]),
    isChain: z.boolean(),
  }),
  revenue: z.object({
    low: z.number().describe("Annual revenue lower bound in local currency units"),
    high: z.number().describe("Annual revenue upper bound in local currency units"),
    currency: z.string().describe("ISO 4217 code"),
    confidence: z.enum(["low", "medium", "high"]),
    reasoning: z.string(),
    drivers: z.array(z.string()),
  }),
  scores: z.object({
    opportunity: Score("Overall attractiveness as a freelance client, integer 0-100"),
    digitalMaturity: Score(),
    socialVisibility: Score(),
    reputation: Score(),
    budgetFit: Score("Ability and willingness to pay for dev work, integer 0-100"),
    urgency: Score("How much the current gaps are costing them right now, integer 0-100"),
  }),
  social: z.object({
    summary: z.string(),
    channels: z.array(
      z.object({
        platform: z.string(),
        status: z.enum(["strong", "active", "weak", "missing", "unknown"]),
        detail: z.string(),
        url: z.string().nullable(),
      }),
    ),
  }),
  customers: z.object({
    primary: z.string(),
    segments: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        share: z.number().describe("Approximate share of customers, percent; segments sum to ~100"),
      }),
    ),
    journey: z.string().describe("How a typical customer discovers and chooses this business"),
  }),
  audit: z.object({
    strengths: z.array(z.string()),
    gaps: z.array(
      z.object({
        issue: z.string(),
        impact: z.enum(["high", "medium", "low"]),
        evidence: z.string(),
      }),
    ),
  }),
  competition: z.object({
    landscape: z.string(),
    notable: z.array(z.string()),
  }),
  pitch: z.object({
    headline: z.string().describe("One-line hook for the pitch"),
    angle: z.string().describe("The core argument, framed around their business outcome"),
    services: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        whyTheyNeedIt: z.string(),
        expectedImpact: z.string(),
        priceLow: z.number().describe("Local currency"),
        priceHigh: z.number().describe("Local currency"),
        pricingModel: z.enum(["one-time", "monthly", "retainer"]),
        acceptanceProbability: Score("Likelihood they say yes, integer 0-100"),
        effortDays: z.number(),
      }),
    ),
    willAgreeOn: z.string().describe("The specific offer they are most likely to accept and why"),
    talkingPoints: z.array(z.string()),
    objections: z.array(z.object({ objection: z.string(), response: z.string() })),
    decisionMaker: z.string(),
    bestChannel: z.string(),
    bestTiming: z.string(),
    outreach: z.object({ subject: z.string(), body: z.string() }),
  }),
  risks: z.array(z.string()),
});

export type Report = z.infer<typeof ReportSchema> & {
  source: "heuristic" | "ai";
  generatedAt: number;
  model?: string;
};

export interface SystemStatus {
  ai: boolean;
  google: boolean;
  model: string;
}
