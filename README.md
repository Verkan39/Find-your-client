# Find Your Client

Lead intelligence for freelance developers. Pick a neighbourhood and the app finds every independent local business in it. It then audits each one's online presence, estimates revenue, works out who their customers are, and writes a pitch: what to offer, at what price, how likely they are to say yes, and the message to send.

## Quick start (local)

Needs Node 22+ and Docker (for the local Supabase stack).

```bash
npm install
npm run db:start             # starts Supabase in Docker and applies supabase/migrations
cp .env.example .env.local   # then fill in the Supabase values printed by db:start
npm run dev                  # http://localhost:3000
```

`npx supabase status` prints the local URL and keys again. The local Supabase dashboard is at http://127.0.0.1:54323, and confirmation and reset emails land in the test inbox at http://127.0.0.1:54324. Locally, email confirmation is off, so signup logs you straight in.

| Variable | Required | What it does |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable key (`sb_publishable_…`). Safe in the browser, because row-level security protects the data. |
| `SUPABASE_SECRET_KEY` | yes | Secret key (`sb_secret_…`). Server only; the worker uses it to write results and to read users' encrypted keys. |
| `KEYS_ENCRYPTION_SECRET` | yes | Random 32+ character string that encrypts users' API keys. Generate it once (see `.env.example`). Changing it makes saved keys unreadable. |
| `DAILY_BUSINESS_LIMIT` | no | Max businesses one user can request per 24 h (default 150). Keeps OpenStreetMap usage fair. |
| `OSM_CONTACT_EMAIL` | no | Your contact in the OpenStreetMap User-Agent, as their usage policy asks. |
| `ANALYSIS_CONCURRENCY` | no | How many businesses are analysed in parallel (default 3). |

The app has no shared AI or Google key. Each user connects their own on the Profile page (see below).

## Bring your own keys

Users open **Profile → API keys & providers**, re-enter their password, and connect:

| Purpose | Providers |
|---|---|
| AI model (research + brief) | Anthropic Claude, OpenAI, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, any OpenAI-compatible endpoint |
| Business data (ratings, reviews) | Google Places (New), Yelp Fusion |
| Web search for deep research | The AI provider's own search (Claude, Gemini, OpenAI), or Tavily, Brave Search, Serper |

- **Checking keys**: every key is tested against the provider before it's saved. For AI providers, the live model list comes back so users pick a model that exists.
- **Storage**: keys are encrypted with AES-256-GCM (`src/lib/crypto.ts`) and stored in `api_keys`. That table has RLS enabled and no policies, so only the server can read it. Users only ever see a hint like `sk-…a1b2`.
- **Password lock**: key management requires re-entering the password. That sets a signed, httpOnly cookie that expires after 15 minutes, and repeated wrong passwords are rate-limited.
- **How the AI layer adapts** (`src/lib/llm/`):
  - Claude uses the official SDK with native structured output and web search, with request options matched to the chosen model.
  - OpenAI uses strict JSON-schema output and its web search tool.
  - Gemini uses JSON mode and Google Search grounding.
  - OpenAI-compatible providers use JSON mode.
  - Every provider's output is validated against the report schema, with one automatic repair round if it doesn't match.
- **Research without built-in search**: providers that can't search by themselves get research through the user's search key. The app runs targeted searches, reads the top pages, and the model writes notes from that evidence.

## Hosted Supabase (production)

1. Create a project at https://supabase.com/dashboard.
2. Apply the schema: either run `npx supabase link --project-ref <ref>` and then `npm run db:push`, or paste `supabase/migrations/*.sql` into the dashboard's SQL editor.
3. Under **Authentication → URL Configuration**, set **Site URL** to your app's URL and add `https://<your-domain>/auth/callback` to **Redirect URLs**.
4. Under **Project Settings → API Keys**, copy the URL, publishable key and secret key into your environment.

## Accounts & data

- **Auth**: Supabase email + password, with signup, login, forgot/reset password and sign out. `src/proxy.ts` refreshes the session on every page request and sends signed-out visitors to `/login`.
- **Schema** (`supabase/migrations/`):
  - `profiles` has one row per user, created by a trigger on signup.
  - `scans` holds each search.
  - `businesses` holds everything learned about each business.
  - `scan_events` is the activity feed.
  - `scan_overview` is a view with progress counters.
- **Security**:
  - Every table has row-level security, and users can only read their own rows.
  - Users can create and delete their own scans but can't modify results. The background worker writes those using the secret key, and API routes check ownership before triggering it.
  - Child rows inherit their owner from the parent scan through a database trigger.

## How a scan works

1. **Geocode**: Nominatim turns "Koramangala, Bengaluru" into coordinates, a country and a currency.
2. **Discover**: Overpass (OpenStreetMap) lists named businesses in ~30 categories within the radius. Chain outlets are skipped by default because their marketing is decided at head office. The selection is spread round-robin across categories and favours businesses you can actually contact.
3. **Crawl**: the homepage plus up to 4 key pages (menu, booking, contact…) are checked for HTTPS, mobile viewport, speed, SEO metadata, schema.org, tech stack, analytics, booking and ordering tools, e-commerce, chat widgets, social links, contact details and copyright year.
4. **Enrich** (optional): the business is matched on the user's Google Places or Yelp account.
5. **Score**: the built-in engine (`src/lib/heuristics.ts`) produces a full report. It covers revenue range, six scores, gaps, customer segments, services with local pricing and acceptance probability, talking points, objections and an outreach draft.
6. **Research + brief** (with the user's AI key): the chosen model researches the business on the web, then writes a structured brief, using the engine's numbers as a starting point.

Scans run in the background on the server and their state is kept in Supabase. If the server restarts, an interrupted scan picks up where it stopped. Because the worker runs inside the Node server, deploy to a long-running host (a VPS, Railway, Render, Fly.io). On serverless platforms, background work gets cut off.

### Analysis depth (per scan)

- **Deep research**: web research + AI brief. Slowest and most accurate, roughly $0.30–0.60 per business.
- **AI brief**: AI brief from crawl and map data only, roughly $0.08–0.15 per business.
- **Engine only**: free and fast.

## Stack

Next.js 16 (App Router), React 19, React Three Fiber + drei + postprocessing for the 3D scenes, Framer Motion, Tailwind CSS 4, Supabase (Postgres + Auth), cheerio, and the Anthropic TypeScript SDK.

```
src/
  app/                 pages + API routes
  components/three/    HeroScene (globe), Constellation (3D lead map), ScoreOrb
  lib/
    categories.ts      category knowledge base + service catalogue
    market.ts          country purchasing-power scaling and currency
    discovery.ts       Nominatim + Overpass
    crawler.ts         website audit
    heuristics.ts      scoring engine + report builder
    ai.ts              research + brief, provider-agnostic
    llm/               Anthropic, OpenAI-compatible and Gemini clients + JSON validation
    providers/         provider catalog + HTTP/error handling
    keys.ts, crypto.ts encrypted per-user API keys and settings
    places.ts          Google Places + Yelp
    search.ts          Tavily, Brave, Serper
    pipeline.ts        background job runner
    db.ts              Supabase data access
    supabase/          browser, server (per-user) and admin clients
  proxy.ts             session refresh + route protection
supabase/
  migrations/          database schema, RLS policies, triggers
```

## Caveats

- Revenue and prices are estimates built from category baselines, size signals and coarse per-country purchasing-power factors. Treat them as a guide and check before quoting.
- Social follower counts aren't scraped. Channels show as "active" when linked, and "strong" only when the AI research found evidence.
- Public Overpass servers are sometimes overloaded. Discovery retries across mirrors, and a failed scan can be retried from its page.
- Users pay their own providers directly. The AI-cost estimates shown in the app are rough and depend on the provider and model they pick.

Map data © OpenStreetMap contributors (ODbL).
