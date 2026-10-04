import { CATEGORY_BY_KEY } from "./categories";
import { readablePage } from "./crawler";
import { mergedSocials, type AnalysisContext } from "./heuristics";
import type { UserConfig } from "./keys";
import { createLlm, generateJson } from "./llm";
import { PROVIDERS } from "./providers/catalog";
import { ProviderError } from "./providers/http";
import { webSearch, type SearchConfig, type SearchHit } from "./search";
import { ReportSchema, type Business, type Report, type Research } from "./types";

/**
 * The AI half of the pipeline, provider-agnostic: it builds the evidence and
 * prompts, then hands them to whichever provider the user configured.
 */

/** Compact, model-friendly fact sheet of everything we already know. */
function factSheet(b: Business, ctx: AnalysisContext, heuristic: Report) {
  const c = b.crawl;
  const cat = CATEGORY_BY_KEY[b.category];
  return {
    business: {
      name: b.name,
      category: cat.label,
      region: ctx.region,
      country: ctx.countryCode?.toUpperCase() ?? "unknown",
      localCurrency: ctx.currency,
      address: b.address,
      coordinates: [b.lat, b.lon],
      phone: b.phone,
      email: b.email,
      website: b.website,
      openingHours: b.openingHours,
      chainBrand: b.brand,
      socialsKnown: mergedSocials(b),
      mapTags: Object.fromEntries(Object.entries(b.tags).filter(([k]) => !k.startsWith("name:") && !k.startsWith("source"))),
    },
    websiteCrawl: c
      ? {
          reachable: c.ok,
          error: c.error,
          finalUrl: c.finalUrl,
          https: c.https,
          htmlResponseMs: c.loadMs,
          pagesCrawled: c.pagesCrawled,
          title: c.title,
          metaDescription: c.metaDescription,
          mobileViewport: c.hasViewport,
          openGraph: c.hasOpenGraph,
          schemaTypes: c.jsonLdTypes,
          techStack: c.tech,
          analytics: c.analytics,
          bookingOrOrdering: c.booking,
          ecommerce: c.ecommerce,
          chatWidgets: c.chat,
          emailsFound: c.emails,
          phonesFound: c.phones,
          copyrightYear: c.copyrightYear,
          contactForm: c.hasContactForm,
          wordCount: c.wordCount,
          headings: c.pageHeadings,
          textSample: c.textSample.slice(0, 5000),
        }
      : "No website to crawl",
    ratingsAndReviews: b.google ?? "Not available (no business-data provider configured)",
    nearbyCompetitorsInScan: ctx.peers.slice(0, 15),
    heuristicBaseline: {
      note: "Rule-based estimates from category baselines. Use as an anchor; override wherever your evidence says otherwise.",
      size: heuristic.profile.size,
      priceTier: heuristic.profile.priceTier,
      revenue: heuristic.revenue,
      scores: heuristic.scores,
      measuredFacts: heuristic.keyInsights,
      gaps: heuristic.audit.gaps,
      candidateServices: heuristic.pitch.services.map((s) => ({ name: s.name, priceLow: s.priceLow, priceHigh: s.priceHigh, pricingModel: s.pricingModel })),
    },
  };
}

const RESEARCH_SYSTEM = `You are a meticulous business research analyst working for a freelance web/software developer who wants to win this local business as a client.

Investigate the business using the web search tools you have. Be thorough and skeptical; it's fine to take time. Cover, where findable:
- Identity: confirm it's the right business (name + locality). Owner/founder name, years operating, number of branches.
- Reputation: Google/Tripadvisor/Justdial/Yelp/Practo/Zomato-style ratings, review volume, recurring praise and complaints (especially complaints software could fix: booking hassles, unanswered calls, no online menu, slow replies).
- Social presence: Instagram/Facebook/YouTube/LinkedIn handles, approximate follower counts and posting recency if visible in results, quality of content.
- Commerce: pricing/menu levels, delivery-app or booking-platform listings (and so commissions paid), online payment options.
- Size signals: staff count, seating/rooms/chairs, ads running, press coverage, hiring posts.
- Competitors: 2-4 nearby rivals and how their digital presence compares.
- Anything recent: renovations, new branches, closures, awards.

Rules:
- Do not invent facts. Mark anything inferred as (inferred). If you can't find something, say so.
- Prefer the business's own site and major review platforms. Don't fetch the same page twice.
- Finish with research notes in markdown, grouped under the headings above, each fact followed by its source URL in parentheses. End with a short "Implications for a freelance pitch" section.
- After the notes, output exactly these three lines (use "none" when you found nothing you're confident belongs to this business):
OFFICIAL_WEBSITE: <url or none>
INSTAGRAM: <url or none>
FACEBOOK: <url or none>`;

const NOTES_FORMAT = `Cover, where the evidence allows: identity (owner, years operating, branches), reputation (ratings, review themes, complaints software could fix), social presence (handles, follower counts, posting recency), commerce (prices, delivery/booking platforms and commissions), size signals, 2-4 competitors, and anything recent.

Rules:
- Use only the evidence provided. Do not invent facts; mark inferences as (inferred) and say when something wasn't found.
- Write research notes in markdown grouped under those headings, each fact followed by its source URL in parentheses. End with a short "Implications for a freelance pitch" section.
- After the notes, output exactly these three lines (use "none" when not confidently found):
OFFICIAL_WEBSITE: <url or none>
INSTAGRAM: <url or none>
FACEBOOK: <url or none>`;

/** Used when the AI provider can't search by itself: we search, it analyses. */
const EVIDENCE_RESEARCH_SYSTEM = `You are a meticulous business research analyst working for a freelance web/software developer who wants to win this local business as a client. You are given search results and page extracts gathered for you.

${NOTES_FORMAT}`;

const LINK_LINE = /^(OFFICIAL_WEBSITE|INSTAGRAM|FACEBOOK):\s*(\S+)\s*$/gim;

function extractLinks(text: string): { notes: string; found: NonNullable<Research["found"]> } {
  const found: NonNullable<Research["found"]> = {};
  for (const m of text.matchAll(LINK_LINE)) {
    const url = m[2].replace(/[<>]/g, "");
    if (!/^https?:\/\//i.test(url)) continue;
    const key = m[1].toUpperCase();
    if (key === "OFFICIAL_WEBSITE") found.website = url;
    else if (key === "INSTAGRAM") found.instagram = url;
    else found.facebook = url;
  }
  return { notes: text.replace(LINK_LINE, "").trim(), found };
}

const REPORT_SYSTEM = `You are a senior freelance-business strategist. You turn research about a local business into a decisive client-acquisition brief for a young freelance developer.

Principles:
- Be specific to THIS business. Every gap, talking point and the outreach message must reference concrete evidence (a missing feature, a review theme, a competitor, a number). Generic advice is a failure.
- Money: all amounts in the local currency given. Revenue is an annual estimate with honest confidence and reasoning; triangulate category norms, review volume, price level, size signals and local purchasing power. Service prices must reflect what freelancers in that market actually charge small businesses - not US agency rates - and what this business can afford.
- acceptanceProbability is calibrated: 70+ only for cheap, obviously-valuable offers to a reachable, able-to-pay owner. Chains, unreachable or struggling businesses score low.
- Order services by what they should be pitched first. "willAgreeOn" names the single offer most likely to get a yes, with price, and the reason.
- Scores are integers 0-100. Opportunity weighs need (gaps x how much the category depends on digital), ability to pay, reachability and decision-maker access.
- Outreach message: under 160 words, warm, local, no jargon, opens with a specific observation, offers a concrete next step (e.g. a 10-minute mock-up walkthrough). Use [Your name] placeholders for the sender.
- Social channel statuses: "strong"/"active"/"weak" only with evidence; "unknown" when unverified.
- Customer segments: 2-4 segments whose shares sum to about 100.
- Never fabricate. If the evidence is thin, say so in reasoning and risks.

Brevity (the dashboard is numbers-first; people scan, they don't read):
- verdict: max 14 words, starts with Hot/Warm/Cool lead, names the offer.
- keyInsights: 3-5 items, most decisive first. Each leads with a hard number or value in "stat" (e.g. "4.6★", "0", "25%", "© 2019", "₹40k/mo", "12k followers"), a 2-4 word label, and a detail of at most 12 words. Prefer facts from research (follower counts, commission paid, review themes) over generic ones; measuredFacts in the baseline are verified and can be reused.
- Every other free-text field: one or two short sentences, max 25 words. Talking points max 18 words each. No filler, no hedging adverbs.`;

const researchPrompt = (facts: ReturnType<typeof factSheet>) =>
  `Research this business in depth.\n\n<known_facts>\n${JSON.stringify(facts.business, null, 1)}\n</known_facts>\n\n<website_crawl>\n${JSON.stringify(facts.websiteCrawl, null, 1)}\n</website_crawl>\n\n<ratings_and_reviews>\n${JSON.stringify(facts.ratingsAndReviews, null, 1)}\n</ratings_and_reviews>`;

const finish = (raw: { text: string; sources: { title: string; url: string }[]; searches: number }): Research => {
  const { notes, found } = extractLinks(raw.text);
  return { notes: notes || "No research notes were produced.", sources: raw.sources.slice(0, 25), searches: raw.searches, found };
};

/**
 * Stage 1: web research. Uses the provider's own search tool when it has one;
 * otherwise (or if that fails and a search key exists) we run the searches and
 * the model analyses the results. Returns null when research can't run.
 */
export async function research(
  b: Business, ctx: AnalysisContext, heuristic: Report, cfg: UserConfig, note: (msg: string) => void = () => {},
): Promise<Research | null> {
  if (!cfg.llm || !cfg.research) return null;
  const llm = createLlm(cfg.llm);
  const facts = factSheet(b, ctx, heuristic);

  if (cfg.research === "native" && llm.research) {
    try {
      return finish(await llm.research({ system: RESEARCH_SYSTEM, user: researchPrompt(facts) }));
    } catch (e) {
      if (e instanceof ProviderError && e.isAuth) throw e;
      if (!cfg.researchFallback || !cfg.search) throw e;
      note(`${PROVIDERS[cfg.llm.provider].name} web search failed (${e instanceof Error ? e.message : e}); using ${PROVIDERS[cfg.search.provider].name} instead`);
    }
  }
  if (!cfg.search) return null;
  return finish(await searchThenAnalyse(b, ctx, facts, cfg.search, (args) => llm.complete(args)));
}

/** Generic research: run targeted searches, read the best pages, let the model write notes. */
async function searchThenAnalyse(
  b: Business, ctx: AnalysisContext, facts: ReturnType<typeof factSheet>, search: SearchConfig,
  complete: (args: { system: string; messages: { role: "user"; content: string }[]; maxTokens: number }) => Promise<{ text: string }>,
) {
  const cat = CATEGORY_BY_KEY[b.category];
  const where = ctx.region;
  const queries = [
    `"${b.name}" ${where}`,
    `"${b.name}" ${where} reviews`,
    `"${b.name}" instagram OR facebook`,
    `"${b.name}" owner OR founder OR "established"`,
    `best ${cat.label.toLowerCase()} in ${where}`,
  ];
  const results = await Promise.allSettled(queries.map((q) => webSearch(search, q, 6)));
  const hits = new Map<string, SearchHit & { query: string }>();
  results.forEach((r, i) => {
    if (r.status === "fulfilled") for (const h of r.value) if (!hits.has(h.url)) hits.set(h.url, { ...h, query: queries[i] });
  });
  if (!hits.size) {
    const err = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (err) throw err.reason;
  }

  // Read the few pages most likely to be about this business (skip social sites, which block bots).
  const nameBit = b.name.toLowerCase().split(/\s+/)[0];
  const readable = [...hits.values()]
    .filter((h) => !/(instagram|facebook|tiktok|x\.com|twitter|linkedin)\./i.test(h.url))
    .sort((a, c) => Number(c.title.toLowerCase().includes(nameBit)) - Number(a.title.toLowerCase().includes(nameBit)))
    .slice(0, 3);
  const pages = await Promise.all(readable.map(async (h) => ({ url: h.url, text: await readablePage(h.url, 3500) })));

  const evidence = [
    "<search_results>",
    ...[...hits.values()].slice(0, 24).map((h) => `- [${h.query}] ${h.title} (${h.url}): ${h.snippet.slice(0, 300)}`),
    "</search_results>",
    ...pages.filter((p) => p.text).map((p) => `<page url="${p.url}">\n${p.text}\n</page>`),
  ].join("\n");

  const { text } = await complete({
    system: EVIDENCE_RESEARCH_SYSTEM,
    messages: [{ role: "user", content: `${researchPrompt(facts)}\n\n<evidence>\n${evidence}\n</evidence>` }],
    maxTokens: 8000,
  });
  return { text, sources: [...hits.values()].map((h) => ({ title: h.title, url: h.url })), searches: queries.length };
}

/** Stage 2: synthesise everything into the structured report. */
export async function writeReport(b: Business, ctx: AnalysisContext, heuristic: Report, res: Research | null, cfg: UserConfig): Promise<Report> {
  if (!cfg.llm) throw new Error("No AI provider configured");
  const llm = createLlm(cfg.llm);
  const facts = factSheet(b, ctx, heuristic);
  const parsed = await generateJson(llm, {
    name: "report",
    schema: ReportSchema,
    system: REPORT_SYSTEM,
    user: `Write the client-acquisition brief for this business.\n\n<facts>\n${JSON.stringify(facts, null, 1)}\n</facts>\n\n<web_research>\n${res ? res.notes : "Web research was not run for this business; rely on the facts above and say where evidence is thin."}\n</web_research>`,
  });
  // Schemas can't express integer ranges, so normalise scores here.
  const pct = (n: number) => Math.round(Math.max(0, Math.min(100, Number(n) || 0)));
  const scores = Object.fromEntries(Object.entries(parsed.scores).map(([k, v]) => [k, pct(v)])) as Report["scores"];
  const services = parsed.pitch.services.map((s) => ({ ...s, acceptanceProbability: pct(s.acceptanceProbability) }));
  return {
    ...parsed, scores, pitch: { ...parsed.pitch, services },
    source: "ai", generatedAt: Date.now(), model: `${PROVIDERS[cfg.llm.provider].name} · ${cfg.llm.model}`,
  };
}
