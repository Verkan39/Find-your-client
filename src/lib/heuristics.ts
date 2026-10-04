import { CATEGORY_BY_KEY, SERVICES, type CategoryDef, type ServiceKey } from "./categories";
import { deriveInsights, deriveVerdict } from "./insights";
import { placesSourceName } from "./places";
import { formatMoney, localize } from "./market";
import type { Business, Report, Socials } from "./types";

export interface AnalysisContext {
  countryCode: string | null;
  currency: string;
  region: string;
  /** Other businesses of the same category found in this scan. */
  peers: { name: string; hasWebsite: boolean }[];
}

type Size = Report["profile"]["size"];
type Tier = Report["profile"]["priceTier"];
type Gap = Report["audit"]["gaps"][number];

const hostOf = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
};
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const clamp = (n: number, lo = 0, hi = 100) => Math.round(Math.max(lo, Math.min(hi, n)));
const YEAR = new Date().getFullYear();

const WHATSAPP_MARKETS = new Set(["in", "br", "id", "mx", "ng", "ke", "ae", "pk", "za", "es", "it", "ar", "co", "my", "sa", "eg", "tr", "bd", "lk", "np", "ph", "de", "nl"]);

const OUTDATED_BUILDERS = ["GoDaddy Builder", "Weebly", "Joomla", "Google Sites"];

export function mergedSocials(b: Business): Socials {
  return { ...b.socials, ...(b.crawl?.socials ?? {}) };
}

function estimateSize(b: Business, cat: CategoryDef): { size: Size; employees: string } {
  const reviews = b.google?.reviewCount;
  let size: Size = "small";
  if (b.brand) size = "medium";
  else if (reviews != null) size = reviews < 25 ? "micro" : reviews < 150 ? "small" : reviews < 700 ? "medium" : "large";
  else if (!b.website && !b.phone) size = "micro";
  else if (b.crawl?.ok && b.crawl.pagesCrawled.length >= 4 && (b.crawl.booking.length || b.crawl.ecommerce.length)) size = "small";

  const staff: Record<Size, string> =
    cat.group === "Food & Drink" || cat.group === "Hospitality"
      ? { micro: "2-5 staff", small: "6-15 staff", medium: "15-40 staff", large: "40+ staff" }
      : { micro: "1-3 people", small: "4-10 people", medium: "10-30 people", large: "30+ people" };
  return { size, employees: staff[size] };
}

function estimateTier(b: Business): Tier {
  const pl = b.google?.priceLevel;
  if (pl === "inexpensive" || pl === "free") return "budget";
  if (pl === "moderate") return "mid";
  if (pl === "expensive") return "premium";
  if (pl === "very_expensive") return "luxury";
  const text = `${b.crawl?.textSample ?? ""} ${b.crawl?.title ?? ""}`.toLowerCase();
  if (/\b(luxury|luxurious|bespoke|fine dining|five[- ]star|5[- ]star)\b/.test(text)) return "luxury";
  if (/\b(premium|boutique|exclusive|artisan|signature|gourmet)\b/.test(text)) return "premium";
  if (/\b(cheap|budget|affordable|low cost|discount)\b/.test(text)) return "budget";
  return "mid";
}

/* ------------------------------ scoring ------------------------------ */

function digitalMaturity(b: Business): { score: number; strengths: string[]; gaps: Gap[] } {
  const c = b.crawl;
  const strengths: string[] = [];
  const gaps: Gap[] = [];

  if (!b.website) {
    gaps.push({ issue: "No website", impact: "high", evidence: "No website listed on the map or found via search; customers who search online only see the bare map listing." });
    let s = 8;
    if (b.google?.reviewCount) { s += 8; strengths.push(`Has a ${placesSourceName(b.google)} listing (${b.google.reviewCount} reviews)`); }
    const soc = Object.keys(mergedSocials(b)).length;
    if (soc) { s += Math.min(10, soc * 5); strengths.push(`Active on ${soc} social channel${soc > 1 ? "s" : ""}`); }
    return { score: clamp(s), strengths, gaps };
  }

  if (!c || !c.ok) {
    gaps.push({ issue: "Website is broken or unreachable", impact: "high", evidence: `Their listed site (${hostOf(b.website)}) doesn't load: ${c?.error ?? "it failed to load"}. Anyone who clicks through from Google or the map hits a dead end.` });
    return { score: 12, strengths, gaps };
  }

  let s = 22;
  strengths.push("Has a working website");

  if (c.https) { s += 8; } else gaps.push({ issue: "No HTTPS", impact: "high", evidence: "Browsers show 'Not secure' on the site, which scares off visitors and hurts search ranking." });

  if (c.hasViewport) { s += 9; strengths.push("Mobile viewport configured"); }
  else gaps.push({ issue: "Not mobile-friendly", impact: "high", evidence: "No mobile viewport tag; on phones the site renders as a shrunken desktop page." });

  if (c.loadMs != null) {
    if (c.loadMs < 1500) { s += 7; strengths.push(`Fast server response (${(c.loadMs / 1000).toFixed(1)}s)`); }
    else if (c.loadMs < 3500) s += 3;
    else gaps.push({ issue: "Slow loading", impact: "medium", evidence: `Homepage took ${(c.loadMs / 1000).toFixed(1)}s just to download HTML; mobile visitors bounce after ~3s.` });
  }

  if (c.title && c.metaDescription) { s += 6; }
  else gaps.push({ issue: "Missing search metadata", impact: "medium", evidence: `${!c.title ? "No page title" : "No meta description"}; Google shows a random snippet instead of a compelling one.` });

  if (c.jsonLdTypes.some((t) => /business|restaurant|store|clinic|dentist|organization|hotel|place/i.test(t))) { s += 5; strengths.push("Structured data for search engines"); }
  else gaps.push({ issue: "No local-business schema markup", impact: "low", evidence: "No LocalBusiness JSON-LD, so Google can't show rich results (hours, ratings, price)." });

  if (c.analytics.length) { s += 6; strengths.push(`Tracks visitors (${c.analytics.join(", ")})`); }
  else gaps.push({ issue: "No analytics", impact: "medium", evidence: "No Google Analytics, Tag Manager or Meta Pixel detected; they can't tell which marketing works." });

  if (c.booking.length || c.ecommerce.length) { s += 11; strengths.push(`Online conversion: ${[...c.booking, ...c.ecommerce].slice(0, 3).join(", ")}`); }

  if (c.hasContactForm) s += 4;
  if (c.chat.length) { s += 3; strengths.push(`Live chat / messaging (${c.chat.join(", ")})`); }
  if (c.hasOpenGraph) s += 3;
  else gaps.push({ issue: "No social share previews", impact: "low", evidence: "No Open Graph tags; links shared on WhatsApp/Instagram show no image or title." });

  if (c.copyrightYear) {
    if (c.copyrightYear >= YEAR - 1) { s += 6; }
    else gaps.push({ issue: "Site looks abandoned", impact: "medium", evidence: `Footer says © ${c.copyrightYear}; visitors read stale sites as a sign the business is careless or closed.` });
  }

  const outdated = c.tech.filter((t) => OUTDATED_BUILDERS.includes(t));
  if (outdated.length) gaps.push({ issue: "Built on a dated site builder", impact: "medium", evidence: `Runs on ${outdated.join(", ")}, which limits speed, SEO and integrations.` });
  else if (c.tech.some((t) => ["Next.js", "Webflow", "Shopify", "Framer"].includes(t))) { s += 4; strengths.push(`Modern stack (${c.tech.join(", ")})`); }

  if (c.imagesTotal > 5 && c.imagesWithoutAlt / c.imagesTotal > 0.6) gaps.push({ issue: "Images missing alt text", impact: "low", evidence: `${c.imagesWithoutAlt} of ${c.imagesTotal} images have no alt text (accessibility + image search).` });
  if (c.wordCount < 150) gaps.push({ issue: "Thin content", impact: "medium", evidence: `Only ~${c.wordCount} words across ${c.pagesCrawled.length} page(s); not enough for Google to rank it for services.` });

  return { score: clamp(s), strengths, gaps };
}

function socialScore(b: Business) {
  const s = mergedSocials(b);
  const all: (keyof Socials)[] = ["instagram", "facebook", "whatsapp", "youtube", "linkedin", "tiktok", "x", "pinterest"];
  const label: Record<keyof Socials, string> = {
    instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", youtube: "YouTube",
    linkedin: "LinkedIn", tiktok: "TikTok", x: "X / Twitter", pinterest: "Pinterest",
  };
  const toUrl = (k: keyof Socials, v: string) => {
    if (v.startsWith("http")) return v;
    const base: Record<keyof Socials, string> = {
      instagram: "https://instagram.com/", facebook: "https://facebook.com/", whatsapp: "https://wa.me/",
      youtube: "https://youtube.com/", linkedin: "https://linkedin.com/company/", tiktok: "https://tiktok.com/@",
      x: "https://x.com/", pinterest: "https://pinterest.com/",
    };
    return base[k] + v.replace(/[^\w.+-]/g, "");
  };
  const channels: Report["social"]["channels"] = [];
  let score = 0;
  for (const k of all) {
    if (s[k]) {
      score += k === "instagram" || k === "facebook" ? 16 : 9;
      channels.push({ platform: label[k], status: "active", detail: "Linked from their website or map listing (follower counts not verified).", url: toUrl(k, s[k]!) });
    } else if (k === "instagram" || k === "facebook" || k === "whatsapp") {
      channels.push({ platform: label[k], status: b.crawl?.ok ? "missing" : "unknown", detail: b.crawl?.ok ? "Not linked anywhere on their website." : "Couldn't verify without a working website.", url: null });
    }
  }
  const g = b.google;
  if (g?.reviewCount != null) {
    const st = g.reviewCount > 300 ? "strong" : g.reviewCount > 60 ? "active" : "weak";
    score += Math.min(35, Math.log10(g.reviewCount + 1) * 13);
    channels.unshift({ platform: g.source === "yelp" ? "Yelp" : "Google Maps", status: st, detail: `${g.rating?.toFixed(1) ?? "?"}★ from ${g.reviewCount} reviews`, url: g.mapsUrl ?? null });
  } else {
    score += 8; // they exist on OSM, likely on Google too
    channels.unshift({ platform: "Google Maps", status: "unknown", detail: "Listed on OpenStreetMap; add a Google Places or Yelp key on your Profile to verify rating and review volume.", url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + " " + (b.address ?? ""))}` });
  }
  if (b.website && b.crawl?.ok) score += 8;
  return { score: clamp(score), channels };
}

function reputationScore(b: Business) {
  const g = b.google;
  if (!g?.rating || !g.reviewCount) return 50;
  return clamp(((g.rating - 3) / 2) * 70 + Math.min(30, Math.log10(g.reviewCount + 1) * 11));
}

/* ------------------------------ services ------------------------------ */

function applicableServices(b: Business, cat: CategoryDef, maturity: number, gaps: Gap[], size: Size, countryCode: string | null): ServiceKey[] {
  const c = b.crawl;
  const hasSite = Boolean(b.website && c?.ok);
  const hasGap = (s: string) => gaps.some((g) => g.issue === s);
  const soc = mergedSocials(b);
  const ok: Record<ServiceKey, boolean> = {
    website: !hasSite,
    redesign: hasSite && (maturity < 62 || hasGap("Not mobile-friendly") || hasGap("Site looks abandoned") || hasGap("Built on a dated site builder")),
    booking: cat.transactional === "booking" && !(c?.booking.length),
    ordering: cat.transactional === "ordering" && !(c?.ecommerce.length) && !(c?.booking.some((x) => x === "Toast")),
    ecommerce: cat.transactional === "ecommerce" && !(c?.ecommerce.length),
    localSeo: !((b.google?.reviewCount ?? 0) > 400 && c?.jsonLdTypes.length),
    performance: hasSite && maturity >= 62 && (hasGap("No HTTPS") || hasGap("Slow loading") || hasGap("Missing search metadata")),
    analytics: hasSite && !c?.analytics.length,
    social: !soc.instagram || (!soc.facebook && cat.digitalDependency >= 0.8),
    whatsapp: !soc.whatsapp && !c?.chat.includes("WhatsApp button") && WHATSAPP_MARKETS.has(countryCode ?? ""),
    reviews: (b.google?.reviewCount ?? 0) < 120,
    crm: size !== "micro" && cat.spendPropensity >= 0.5,
    listings: cat.key === "real_estate" && !(c?.ecommerce.length),
    portal: size !== "micro" && cat.spendPropensity >= 0.6 && maturity >= 35,
  };
  // Always make sure the most fundamental fix comes first.
  const ordered = cat.services.filter((s) => ok[s] && s !== "website");
  if (ok.website) ordered.unshift("website");
  for (const extra of ["performance", "analytics"] as ServiceKey[]) if (ok[extra] && !ordered.includes(extra)) ordered.push(extra);
  return ordered.slice(0, 4);
}

/* ------------------------------ main ------------------------------ */

export function heuristicReport(b: Business, ctx: AnalysisContext): Report {
  const cat = CATEGORY_BY_KEY[b.category];
  const cur = ctx.currency;
  const money = (n: number) => formatMoney(n, cur);
  const { size, employees } = estimateSize(b, cat);
  const tier = estimateTier(b);

  const sizeF: Record<Size, number> = { micro: 0.4, small: 1, medium: 2.2, large: 4.5 };
  const tierF: Record<Tier, number> = { budget: 0.7, mid: 1, premium: 1.45, luxury: 2.2 };
  const revLow = localize(cat.revenueUSD[0] * sizeF[size] * tierF[tier], ctx.countryCode);
  const revHigh = localize(cat.revenueUSD[1] * sizeF[size] * tierF[tier], ctx.countryCode);
  const revMid = (revLow + revHigh) / 2;

  const dm = digitalMaturity(b);
  const so = socialScore(b);
  const rep = reputationScore(b);

  const budgetFit = clamp(
    cat.spendPropensity * 55 +
      { micro: 0, small: 15, medium: 25, large: 30 }[size] +
      { budget: -8, mid: 0, premium: 8, luxury: 12 }[tier] +
      (b.brand ? -25 : 0),
  );
  const highGaps = dm.gaps.filter((g) => g.impact === "high").length;
  const urgency = clamp(cat.digitalDependency * (100 - dm.score) * 0.9 + highGaps * 8 + (rep > 70 && dm.score < 40 ? 10 : 0));
  const reachable = Boolean(b.phone || b.email || b.crawl?.emails.length || b.crawl?.phones.length || Object.keys(mergedSocials(b)).length);
  const closed = b.google?.businessStatus && b.google.businessStatus !== "OPERATIONAL";
  const opportunity = clamp(
    urgency * 0.38 + budgetFit * 0.32 + cat.digitalDependency * 100 * 0.15 + (reachable ? 15 : 0) + (rep >= 65 ? 4 : 0) -
      (b.brand ? 20 : 0) - (closed ? 60 : 0),
  );

  /* services & pricing */
  const keys = applicableServices(b, cat, dm.score, dm.gaps, size, ctx.countryCode);
  const services = keys.map((k, i) => {
    const s = SERVICES[k];
    const sizeMul = { micro: 0.7, small: 1, medium: 1.35, large: 1.8 }[size];
    const lo = localize(s.priceUSD[0] * sizeMul, ctx.countryCode);
    const hi = localize(s.priceUSD[1] * sizeMul, ctx.countryCode);
    const annualCost = s.pricingModel === "monthly" ? hi * 12 : hi;
    const shareOfRevenue = annualCost / revMid;
    const gapLink = dm.gaps.find((g) =>
      (k === "website" && (g.issue === "No website" || g.issue === "Website is broken or unreachable")) ||
      (k === "redesign" && /mobile|abandoned|dated|broken/i.test(g.issue)) ||
      (k === "performance" && /HTTPS|Slow|metadata/i.test(g.issue)) ||
      (k === "analytics" && g.issue === "No analytics") ||
      (k === "localSeo" && /schema|metadata|Thin/i.test(g.issue)),
    );
    // Calibrated so that only cheap fixes for a visible problem, at a reachable business that can pay, reach 70+.
    let p = 36 + (i === 0 ? 6 : 0) - i * 3;
    p += gapLink ? (gapLink.impact === "high" ? 16 : gapLink.impact === "medium" ? 10 : 5) : -4;
    p += shareOfRevenue < 0.004 ? 8 : shareOfRevenue < 0.01 ? 4 : shareOfRevenue > 0.025 ? -14 : 0;
    p += (budgetFit - 50) * 0.2 + (urgency - 50) * 0.15;
    p += s.effortDays <= 5 ? 5 : s.effortDays >= 18 ? -8 : 0;
    p += dm.score > 75 ? -6 : 0; // digitally mature owners already have vendors and opinions
    p += b.brand ? -25 : 0;
    p += !reachable ? -15 : 0;
    return {
      name: s.name,
      description: s.description,
      whyTheyNeedIt: gapLink ? gapLink.evidence : whyFor(k, b, cat),
      expectedImpact: s.impact,
      priceLow: lo,
      priceHigh: hi,
      pricingModel: s.pricingModel,
      acceptanceProbability: clamp(p, 5, 88),
      effortDays: s.effortDays,
    };
  });

  const best = [...services].sort((a, b2) => b2.acceptanceProbability - a.acceptanceProbability)[0];
  const upsell = services.find((s) => s !== best);
  const willAgreeOn = best
    ? `${best.name} at around ${money(best.priceLow)}–${money(best.priceHigh)}${best.pricingModel === "monthly" ? "/month" : ""}. It's the cheapest, fastest win relative to their estimated revenue (~${money(revMid)}/yr) and directly fixes something they can see.${upsell ? ` Once it delivers, upsell ${upsell.name.toLowerCase()}.` : ""}`
    : "A small, fixed-price audit and quick-fix package to build trust first.";

  /* story */
  const socials = mergedSocials(b);
  const topGap = dm.gaps.find((g) => g.impact === "high") ?? dm.gaps[0];
  const g = b.google;
  const peersWithSite = ctx.peers.filter((p) => p.hasWebsite);

  const talkingPoints = [
    topGap ? `${topGap.issue}: ${topGap.evidence}` : null,
    g?.rating && g.rating >= 4.2 ? `Their ${g.rating.toFixed(1)}★ reputation is an asset the website/booking flow should be showcasing — lead with a compliment.` : null,
    peersWithSite.length ? `${peersWithSite.length} of ${ctx.peers.length} nearby ${cat.label.toLowerCase()} competitors already have websites — show them a competitor's site side by side.` : ctx.peers.length ? `None of the ${ctx.peers.length} nearby competitors are strong online yet — first-mover advantage in ${ctx.region}.` : null,
    cat.transactional === "booking" && !b.crawl?.booking.length ? "Every booking currently needs a phone call during opening hours; demand after closing time is being lost." : null,
    cat.transactional === "ordering" && b.crawl?.booking.some((x) => /Zomato|Swiggy|Uber Eats|DoorDash|Deliveroo/.test(x)) ? "They rely on delivery aggregators — a direct-ordering channel for repeat customers saves the 15–30% commission." : null,
    !socials.instagram ? `No Instagram linked — for a ${cat.label.toLowerCase()}, that's where ${cat.customers[0].name.toLowerCase()} discover places.` : null,
    `Frame everything in outcomes: more ${cat.transactional === "booking" ? "bookings" : cat.transactional === "ordering" ? "orders" : cat.transactional === "ecommerce" ? "sales" : "enquiries"}, less time on the phone — not technology.`,
  ].filter(Boolean) as string[];

  const objections: Report["pitch"]["objections"] = [
    { objection: "We get enough customers through word of mouth.", response: `Word of mouth still ends in a Google search — ${cat.journey.split(",")[0].toLowerCase()}. I make sure that search ends with you, not a competitor.` },
    { objection: "It's too expensive right now.", response: `Start with ${best?.name.toLowerCase() ?? "a small fix"} (${best ? money(best.priceLow) : "a small fixed fee"}). If it brings in a handful of extra customers it pays for itself — and I can split payment into milestones.` },
    { objection: "We don't have time to manage a website/system.", response: "I set it up to run itself and handle updates for a small monthly fee — you only see new customers coming in." },
  ];
  if (cat.transactional === "ordering") objections.push({ objection: "We already use Zomato/Swiggy/Uber Eats.", response: "Keep them for discovery. A direct channel is for the customers who already know you — every repeat order you move saves the commission." });
  if (cat.transactional === "booking") objections.push({ objection: "Our customers prefer calling.", response: "Keep the phone — online booking just captures people who'd otherwise try someone else after hours. Most systems also cut no-shows with reminders." });
  if (b.website) objections.push({ objection: "We already have a website.", response: `You do — but ${topGap ? topGap.issue.toLowerCase() : "it isn't turning visitors into customers"}. I'll show you exactly what a customer sees on their phone.` });

  const hook = topGap
    ? topGap.issue === "Website is broken or unreachable"
      ? `I tried to visit ${possessive(b.name)} website (${hostOf(b.website ?? "")}) and it doesn't load — ${b.crawl?.error ?? "it seems to be down"}. Customers clicking through from Google are hitting a dead end.`
      : topGap.issue === "No website"
      ? `I was looking at local businesses in ${ctx.region} and noticed ${b.name} doesn't have a website yet — people searching online only see a bare map pin.`
      : `I came across ${possessive(b.name)} website and noticed one thing that's probably costing you customers: ${topGap.issue.toLowerCase()}. ${topGap.evidence}`
    : `I've been looking at local businesses around ${ctx.region} and ${b.name} stood out.`;
  const outreach = {
    subject: topGap?.issue === "No website" ? `A website for ${b.name}?` : topGap?.issue === "Website is broken or unreachable" ? `${possessive(b.name)} website is down` : `Quick idea for ${b.name}`,
    body: `Hi there,\n\n${hook}${g?.rating && g.rating >= 4.2 ? ` That's a shame, because your ${g.rating.toFixed(1)}★ reviews show customers love you.` : ""}\n\nI'm a local developer and I help local businesses like yours get more ${cat.transactional === "booking" ? "bookings" : cat.transactional === "ordering" ? "direct orders" : "customers"} online. For ${b.name}, I'd start with ${best ? best.name.toLowerCase() : "a quick fix"} — ${best?.description.charAt(0).toLowerCase()}${best?.description.slice(1)}\n\nI put together a quick mock-up of what this could look like. Could I show you in 10 minutes this week? No obligation.\n\nBest,\n[Your name]\n[Portfolio link] · [Phone]`,
  };

  const channel = b.email || b.crawl?.emails.length
    ? "Email first (short, with a mock-up screenshot), then follow up in person"
    : socials.instagram ? "Instagram DM with a before/after mock-up, then visit in person"
    : socials.whatsapp || b.phone ? "Walk in or call with a printed/phone mock-up; WhatsApp the link after"
    : "Visit in person — no reliable digital contact found";

  const risks = [
    b.brand ? `Appears to be part of a chain (${b.brand}); marketing decisions are likely made centrally.` : null,
    closed ? `${placesSourceName(g)} lists the business as ${g?.businessStatus?.toLowerCase().replace(/_/g, " ")}.` : null,
    !reachable ? "No phone, email or social contact found — you'll need to visit in person." : null,
    size === "micro" ? "Very small operation; keep the first offer cheap and fixed-price." : null,
    !g ? "Ratings and review volume unverified (no business-data key), so size and revenue are lower-confidence." : null,
    b.crawl?.tech.includes("Wix") || b.crawl?.tech.includes("Squarespace") ? "Uses a DIY builder — the owner (or a relative) may be emotionally attached to the current site." : null,
  ].filter(Boolean) as string[];

  const summary = [
    `${b.name} is a ${size} ${tier === "mid" ? "" : tier + " "}${cat.label.toLowerCase()} in ${ctx.region}${g?.rating ? ` rated ${g.rating.toFixed(1)}★ (${g.reviewCount} reviews)` : ""}.`,
    `Digital maturity is ${dm.score < 35 ? "low" : dm.score < 65 ? "moderate" : "high"} (${dm.score}/100)${topGap ? `; the biggest gap is "${topGap.issue.toLowerCase()}"` : ""}.`,
    `Estimated revenue is ${money(revLow)}–${money(revHigh)} a year, which comfortably supports ${best ? `a ${money(best.priceLow)}–${money(best.priceHigh)} ${best.name.toLowerCase()}` : "a small engagement"}.`,
    opportunity >= 70 ? "This is a strong lead — prioritise it." : opportunity >= 50 ? "A solid lead worth a personalised pitch." : "A weaker lead; approach only with a low-cost offer.",
  ].join(" ");

  const report: Report = {
    source: "heuristic",
    generatedAt: Date.now(),
    verdict: "",
    keyInsights: [],
    summary,
    profile: {
      whatTheyDo: whatTheyDo(b, cat),
      size,
      employeesEstimate: employees,
      priceTier: tier,
      isChain: Boolean(b.brand),
    },
    revenue: {
      low: revLow,
      high: revHigh,
      currency: cur,
      confidence: g?.reviewCount ? "medium" : "low",
      reasoning: `Category baseline for an independent ${cat.label.toLowerCase()}, scaled for a ${size} operation${tier !== "mid" ? ` at ${tier} pricing` : ""} and adjusted to local purchasing power${g?.reviewCount ? `; review volume (${g.reviewCount}) is used as a proxy for footfall` : ""}.`,
      drivers: [
        `Category: ${cat.label}`,
        `Size signal: ${size}${g?.reviewCount ? ` (${g.reviewCount} ${placesSourceName(g)} reviews)` : b.brand ? " (chain)" : ""}`,
        `Price tier: ${tier}`,
        `Market: ${(ctx.countryCode ?? "unknown").toUpperCase()}`,
      ],
    },
    scores: {
      opportunity,
      digitalMaturity: dm.score,
      socialVisibility: so.score,
      reputation: rep,
      budgetFit,
      urgency,
    },
    social: {
      summary: so.score >= 60 ? "Good visibility across channels." : so.score >= 35 ? "Partial visibility; key channels are missing or unverified." : "Weak online visibility; most customers can only find them by walking past.",
      channels: so.channels,
    },
    customers: {
      primary: cat.customers[0].name,
      segments: cat.customers,
      journey: cat.journey,
    },
    audit: { strengths: dm.strengths, gaps: dm.gaps },
    competition: {
      landscape: ctx.peers.length
        ? `${ctx.peers.length} other ${cat.label.toLowerCase()} businesses in this scan; ${peersWithSite.length} have a website.`
        : `No other ${cat.label.toLowerCase()} businesses in this scan's results.`,
      notable: peersWithSite.slice(0, 4).map((p) => p.name),
    },
    pitch: {
      headline: best ? `Help ${b.name} win more ${cat.transactional === "booking" ? "bookings" : cat.transactional === "ordering" ? "orders" : "customers"} with ${best.name.toLowerCase()}` : `Digital quick-wins for ${b.name}`,
      angle: topGap
        ? `Lead with the visible problem (${topGap.issue.toLowerCase()}), quantify what it costs them, and offer a fixed-price fix delivered in ~${best?.effortDays ?? 5} days.`
        : "Position as a growth partner: they're doing well, and a few upgrades can widen the lead over competitors.",
      services,
      willAgreeOn,
      talkingPoints,
      objections,
      decisionMaker: cat.decisionMaker,
      bestChannel: channel,
      bestTiming: cat.timing,
      outreach,
    },
    risks,
  };
  report.keyInsights = deriveInsights(b, report, { total: ctx.peers.length, withWebsite: peersWithSite.length });
  report.verdict = deriveVerdict(report);
  return report;
}

function whatTheyDo(b: Business, cat: CategoryDef) {
  const t = b.tags;
  const extra = [t.cuisine && `${t.cuisine.replace(/;/g, ", ")} cuisine`, t["healthcare:speciality"], t.sport, t.shop && t.shop !== "yes" ? t.shop.replace(/_/g, " ") : null]
    .filter(Boolean).join(" · ");
  const fromSite = b.crawl?.metaDescription || b.crawl?.title;
  return `${cat.label}${extra ? ` (${extra})` : ""}${fromSite ? ` — "${fromSite.slice(0, 160)}"` : ""}`;
}

function whyFor(k: ServiceKey, b: Business, cat: CategoryDef): string {
  switch (k) {
    case "booking": return "Bookings currently need a phone call or walk-in; no online scheduling was found on their site.";
    case "ordering": return "No direct ordering on their site; repeat customers go through phone calls or commission-charging apps.";
    case "ecommerce": return "No online checkout found; products can only be bought in store or via DMs.";
    case "localSeo": return `Customers find a ${cat.label.toLowerCase()} by searching nearby; ranking in the map pack is the cheapest way to get new ones.`;
    case "social": return "Instagram/Facebook aren't linked, but they're the main discovery channel for this category.";
    case "whatsapp": return "Customers in this market already message businesses on WhatsApp; there's no WhatsApp entry point on their site.";
    case "reviews": return b.google?.reviewCount != null ? `Only ${b.google.reviewCount} ${placesSourceName(b.google)} reviews; competitors with more recent reviews rank higher.` : "Review volume is unverified; a review engine builds social proof steadily.";
    case "crm": return "There's no visible loyalty or repeat-customer program; their regulars aren't being re-engaged.";
    case "listings": return "Listings live on third-party portals that charge per lead.";
    case "portal": return "Clients have to call for records, schedules and payments.";
    default: return SERVICES[k].impact;
  }
}

export const formatRevenue = (r: Report) => `${formatMoney(r.revenue.low, r.revenue.currency)}–${formatMoney(r.revenue.high, r.revenue.currency)}`;
