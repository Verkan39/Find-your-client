# Find Your Client

Lead intelligence for freelance developers. Pick a neighbourhood and the app finds every independent local business in it. It then audits each one's online presence, estimates revenue, works out who their customers are, and writes a pitch: what to offer, at what price, how likely they are to say yes, and the message to send.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional keys, see below
npm run dev                  # http://localhost:3000
```

The app works with no keys at all. Keys make the analysis much deeper:

| Variable | What it unlocks |
|---|---|
| `ANTHROPIC_API_KEY` | Claude researches each business on the web (reviews, social following, delivery apps, competitors, owner) and writes the full brief. |
| `GOOGLE_PLACES_API_KEY` | Google rating, review count, price level, hours and review text. These sharpen the size, revenue and reputation estimates. |
| `OSM_CONTACT_EMAIL` | Your contact in the OpenStreetMap User-Agent, as their usage policy asks. |
| `ANALYSIS_CONCURRENCY` | How many businesses are analysed in parallel (default 3). |

## How a scan works

1. **Geocode**: Nominatim turns "Koramangala, Bengaluru" into coordinates, a country and a currency.
2. **Discover**: Overpass (OpenStreetMap) lists named businesses in ~30 categories within the radius. Chain outlets are skipped by default because their marketing is decided at head office. The selection is spread round-robin across categories and favours businesses you can actually contact.
3. **Crawl**: the homepage plus up to 4 key pages (menu, booking, contact…) are checked for HTTPS, mobile viewport, speed, SEO metadata, schema.org, tech stack, analytics, booking and ordering tools, e-commerce, chat widgets, social links, contact details and copyright year.
4. **Enrich** (optional): the business is matched on Google Places.
5. **Score**: the built-in engine (`src/lib/heuristics.ts`) produces a full report. It covers revenue range, six scores, gaps, customer segments, services with local pricing and acceptance probability, talking points, objections and an outreach draft.
6. **Research + brief** (with an Anthropic key): Claude Opus 5.5 runs web search and fetch on the business, then writes a structured brief, using the engine's numbers as a starting point.

Scans run in the background on the server, and their state is kept in SQLite (`data/app.db`). If the server restarts, an interrupted scan picks up where it stopped.

### Analysis depth (per scan)

- **Deep research**: web research + AI brief. Slowest and most accurate, roughly $0.30–0.60 per business.
- **AI brief**: AI brief from crawl and map data only, roughly $0.08–0.15 per business.
- **Engine only**: free and fast.

## Stack

Next.js 16 (App Router), React 19, React Three Fiber + drei + postprocessing for the 3D scenes, Framer Motion, Tailwind CSS 4, `node:sqlite`, cheerio, and the Anthropic TypeScript SDK.

```
src/
  app/                 pages + API routes
  components/three/    HeroScene (globe), Constellation (3D lead map), ScoreOrb
  lib/
    categories.ts      category knowledge base + service catalogue
    market.ts          country purchasing-power scaling and currency
    discovery.ts       Nominatim + Overpass
    crawler.ts         website audit
    google.ts          Places API (New)
    heuristics.ts      scoring engine + report builder
    ai.ts              Claude research + structured brief
    pipeline.ts        background job runner
    db.ts              SQLite persistence
```

## Caveats

- Revenue and prices are estimates built from category baselines, size signals and coarse per-country purchasing-power factors. Treat them as a guide and check before quoting.
- Social follower counts aren't scraped. Channels show as "active" when linked, and "strong" only when the AI research found evidence.
- Public Overpass servers are sometimes overloaded. Discovery retries across mirrors, and a failed scan can be retried from its page.
- This is a single-user local tool with no authentication.

Map data © OpenStreetMap contributors (ODbL).
