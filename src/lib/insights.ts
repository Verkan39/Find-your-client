/**
 * Turns raw crawl/map data plus a report into short, number-led facts for the UI.
 * Pure and client-safe: used by the heuristic engine when writing a report and by
 * the business page for older reports that predate `verdict` / `keyInsights`.
 */
import { formatMoney } from "./market";
import type { Business, KeyInsight, PeerStats, Report } from "./types";

export type CheckState = "pass" | "fail" | "unknown";

export interface CheckItem {
  key: string;
  label: string;
  state: CheckState;
  /** Short evidence shown on hover. */
  note: string;
}

const YEAR = new Date().getFullYear();

/** Website health as a scannable pass/fail list. */
export function digitalChecklist(b: Business): CheckItem[] {
  const c = b.crawl;
  const live = Boolean(b.website && c?.ok);
  const u = (key: string, label: string): CheckItem => ({ key, label, state: "unknown", note: "" });
  const item = (key: string, label: string, pass: boolean, yes: string, no: string): CheckItem =>
    live ? { key, label, state: pass ? "pass" : "fail", note: pass ? yes : no } : u(key, label);

  const socials = { ...b.socials, ...(c?.socials ?? {}) };
  const socialCount = Object.keys(socials).length;

  return [
    {
      key: "site", label: "Website live",
      state: live ? "pass" : "fail",
      note: !b.website ? "No website found" : live ? new URL(c!.finalUrl ?? b.website).hostname : c?.error ?? "Didn't load",
    },
    item("https", "HTTPS", Boolean(c?.https), "Secure connection", "Browsers show 'Not secure'"),
    item("mobile", "Mobile-friendly", Boolean(c?.hasViewport), "Has a mobile viewport", "Renders as a shrunken desktop page"),
    item("speed", "Fast load", (c?.loadMs ?? 99999) < 2500, `${((c?.loadMs ?? 0) / 1000).toFixed(1)}s response`, `${((c?.loadMs ?? 0) / 1000).toFixed(1)}s response`),
    item("seo", "Search metadata", Boolean(c?.title && c?.metaDescription), "Title + description set", "Missing title or description"),
    item("schema", "Rich results", Boolean(c?.jsonLdTypes.length), c?.jsonLdTypes.slice(0, 2).join(", ") ?? "", "No schema.org markup"),
    item("analytics", "Analytics", Boolean(c?.analytics.length), c?.analytics.join(", ") ?? "", "Not tracking visitors"),
    item("convert", "Online booking / sales", Boolean(c?.booking.length || c?.ecommerce.length), [...(c?.booking ?? []), ...(c?.ecommerce ?? [])].slice(0, 2).join(", "), "Phone or walk-in only"),
    item("contact", "Chat / contact form", Boolean(c?.chat.length || c?.hasContactForm), c?.chat[0] ?? "Contact form", "No way to message from the site"),
    {
      key: "social", label: "Social linked",
      state: socialCount ? "pass" : live ? "fail" : "unknown",
      note: socialCount ? Object.keys(socials).join(", ") : live ? "No social profiles found" : "",
    },
    item("fresh", "Recently updated", (c?.copyrightYear ?? YEAR) >= YEAR - 1, c?.copyrightYear ? `© ${c.copyrightYear}` : "No stale dates found", `Last updated © ${c?.copyrightYear}`),
  ];
}

/** The offer most likely to be accepted. */
export function bestOffer(r: Report) {
  return [...r.pitch.services].sort((a, b) => b.acceptanceProbability - a.acceptanceProbability)[0] ?? null;
}

export function leadTier(score: number) {
  return score >= 70 ? "Hot lead" : score >= 50 ? "Warm lead" : "Cool lead";
}

export function deriveVerdict(r: Report): string {
  const best = bestOffer(r);
  if (!best) return `${leadTier(r.scores.opportunity)}: start with a small fixed-price audit.`;
  return `${leadTier(r.scores.opportunity)}: pitch ${best.name.toLowerCase()}, ${best.acceptanceProbability}% likely yes.`;
}

/** Up to five number-led insights, ordered by how much they matter for the pitch. */
export function deriveInsights(b: Business, r: Report, peers?: PeerStats | null): KeyInsight[] {
  const c = b.crawl;
  const g = b.google;
  const out: (KeyInsight & { weight: number })[] = [];
  const add = (weight: number, i: KeyInsight) => out.push({ ...i, weight });

  if (!b.website) add(10, { stat: "No site", label: "Website", detail: "Online searchers only see a bare map pin", tone: "negative" });
  else if (!c?.ok) add(10, { stat: "Down", label: "Website", detail: "Their site doesn't load; visitors hit a dead end", tone: "negative" });

  if (g?.rating && g.reviewCount) {
    const strong = g.rating >= 4.3;
    add(strong ? 8 : 6, {
      stat: `${g.rating.toFixed(1)}★`, label: `${g.source === "yelp" ? "Yelp" : "Google"} rating`,
      detail: `${g.reviewCount} reviews; ${strong ? "customers love them, use it in the pitch" : "reputation needs work"}`,
      tone: strong ? "positive" : "negative",
    });
  }

  if (c?.ok) {
    if (!c.hasViewport) add(9, { stat: "✗", label: "Mobile", detail: "Unusable on phones, where most local searches happen", tone: "negative" });
    if (!c.booking.length && !c.ecommerce.length) add(7, { stat: "0", label: "Online bookings/sales", detail: "Every customer must call or walk in", tone: "negative" });
    if (c.copyrightYear && c.copyrightYear < YEAR - 1) add(6, { stat: `© ${c.copyrightYear}`, label: "Last updated", detail: `Site untouched for ~${YEAR - c.copyrightYear} years`, tone: "negative" });
    if (c.loadMs && c.loadMs > 3000) add(5, { stat: `${(c.loadMs / 1000).toFixed(1)}s`, label: "Load time", detail: "Slow sites lose mobile visitors", tone: "negative" });
    if (!c.analytics.length) add(4, { stat: "None", label: "Analytics", detail: "They can't see which marketing works", tone: "negative" });
  }

  const core = ["instagram", "facebook", "whatsapp"] as const;
  const socials = { ...b.socials, ...(c?.socials ?? {}) };
  const have = core.filter((k) => socials[k]).length;
  if (c?.ok || have) add(have === 0 ? 6 : 3, { stat: `${have}/3`, label: "Core socials", detail: have === 3 ? "Instagram, Facebook and WhatsApp all linked" : "Missing channels where customers discover them", tone: have >= 2 ? "positive" : "negative" });

  if (peers && peers.total > 0) {
    add(5, {
      stat: `${peers.withWebsite}/${peers.total}`, label: "Rivals with websites",
      detail: peers.withWebsite > peers.total / 2 ? "Competitors are ahead online" : "Few rivals online yet: first-mover edge",
      tone: "neutral",
    });
  }

  const high = r.audit.gaps.filter((x) => x.impact === "high").length;
  if (r.audit.gaps.length) add(4, { stat: `${r.audit.gaps.length}`, label: "Fixable gaps", detail: `${high} high-impact, each a reason to hire you`, tone: high ? "negative" : "neutral" });

  const best = bestOffer(r);
  if (best) {
    const mid = (r.revenue.low + r.revenue.high) / 2;
    const pct = ((best.priceHigh * (best.pricingModel === "monthly" ? 12 : 1)) / mid) * 100;
    add(3, { stat: pct < 1 ? "<1%" : `${pct.toFixed(1)}%`, label: "Of their revenue", detail: `Your first offer costs ~${formatMoney(best.priceHigh, r.revenue.currency)}, easy to justify`, tone: "positive" });
  }

  return out.sort((a, b2) => b2.weight - a.weight).slice(0, 5).map(({ weight: _w, ...i }) => i);
}
