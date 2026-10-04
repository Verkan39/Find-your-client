import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CATEGORY_BY_KEY } from "./categories";
import { mergedSocials, type AnalysisContext } from "./heuristics";
import { ReportSchema, type Business, type Report, type Research } from "./types";

export const MODEL = "claude-opus-5-5";
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ maxRetries: 4 }));

export class AIRefusalError extends Error {}

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
    googleMaps: b.google ?? "Not available (no Google Places key configured)",
    nearbyCompetitorsInScan: ctx.peers.slice(0, 15),
    heuristicBaseline: {
      note: "Rule-based estimates from category baselines. Use as an anchor; override wherever your evidence says otherwise.",
      size: heuristic.profile.size,
      priceTier: heuristic.profile.priceTier,
      revenue: heuristic.revenue,
      scores: heuristic.scores,
      gaps: heuristic.audit.gaps,
      candidateServices: heuristic.pitch.services.map((s) => ({ name: s.name, priceLow: s.priceLow, priceHigh: s.priceHigh, pricingModel: s.pricingModel })),
    },
  };
}

const RESEARCH_SYSTEM = `You are a meticulous business research analyst working for a freelance web/software developer who wants to win this local business as a client.

Investigate the business using web search and web fetch. Be thorough and skeptical; it's fine to take time. Cover, where findable:
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
- Never fabricate. If the evidence is thin, say so in reasoning and risks.`;

function collectSources(content: Anthropic.Beta.BetaContentBlock[], into: Map<string, string>) {
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === "web_search_result") into.set(r.url, r.title);
    }
    if (block.type === "text" && block.citations) {
      for (const cit of block.citations) {
        if (cit.type === "web_search_result_location") into.set(cit.url, cit.title ?? cit.url);
      }
    }
  }
}

function checkRefusal(msg: { stop_reason: string | null; stop_details?: { category?: string | null; explanation?: string | null } | null }) {
  if (msg.stop_reason === "refusal") {
    throw new AIRefusalError(`Model declined (${msg.stop_details?.category ?? "unspecified"})`);
  }
}

/** Stage 1: open-ended web research with server-side search + fetch. */
export async function research(b: Business, ctx: AnalysisContext, heuristic: Report): Promise<Research> {
  const facts = factSheet(b, ctx, heuristic);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Research this business in depth.\n\n<known_facts>\n${JSON.stringify(facts.business, null, 1)}\n</known_facts>\n\n<website_crawl>\n${JSON.stringify(facts.websiteCrawl, null, 1)}\n</website_crawl>\n\n<google_maps>\n${JSON.stringify(facts.googleMaps, null, 1)}\n</google_maps>`,
    },
  ];
  const sources = new Map<string, string>();
  let searches = 0;
  let notes = "";

  for (let turn = 0; turn < 5; turn++) {
    const msg = await anthropic()
      .beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        betas: BETAS,
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: RESEARCH_SYSTEM,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 10 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8, max_content_tokens: 12000 },
        ],
        messages,
      })
      .finalMessage();
    checkRefusal(msg);
    collectSources(msg.content, sources);
    searches += msg.content.filter((c) => c.type === "server_tool_use").length;
    notes = msg.content.filter((c) => c.type === "text").map((c) => (c as Anthropic.Beta.BetaTextBlock).text).join("\n").trim() || notes;
    if (msg.stop_reason !== "pause_turn") break;
    // Server-side tool loop hit its iteration cap: send the partial turn back and it resumes.
    messages.push({ role: "assistant", content: msg.content });
  }

  const { notes: clean, found } = extractLinks(notes);
  return {
    notes: clean || "No research notes were produced.",
    sources: [...sources.entries()].slice(0, 25).map(([url, title]) => ({ url, title })),
    searches,
    found,
  };
}

/** Stage 2: synthesise everything into the structured report. */
export async function writeReport(b: Business, ctx: AnalysisContext, heuristic: Report, res: Research | null): Promise<Report> {
  const facts = factSheet(b, ctx, heuristic);
  const msg = await anthropic()
    .beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: BETAS,
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: betaZodOutputFormat(ReportSchema) },
      system: REPORT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Write the client-acquisition brief for this business.\n\n<facts>\n${JSON.stringify(facts, null, 1)}\n</facts>\n\n<web_research>\n${res ? res.notes : "Web research was not run for this business; rely on the facts above and say where evidence is thin."}\n</web_research>`,
        },
      ],
    })
    .finalMessage();
  checkRefusal(msg);
  if (msg.stop_reason === "max_tokens") throw new Error("Report generation hit the output limit");
  const parsed = msg.parsed_output;
  if (!parsed) throw new Error("Model returned a report that didn't match the schema");
  // The schema can't express integer ranges, so normalise scores here.
  const pct = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
  const scores = Object.fromEntries(Object.entries(parsed.scores).map(([k, v]) => [k, pct(v)])) as Report["scores"];
  const services = parsed.pitch.services.map((s) => ({ ...s, acceptanceProbability: pct(s.acceptanceProbability) }));
  return { ...parsed, scores, pitch: { ...parsed.pitch, services }, source: "ai", generatedAt: Date.now(), model: msg.model };
}
