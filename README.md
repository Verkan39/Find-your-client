# Find Your Client

**Lead intelligence for freelance developers.** Pick a neighbourhood and Find Your Client maps every independent business in it. It audits each one's website and online presence, estimates its revenue, works out who its customers are, and writes the pitch for you: what to offer, at what price, how likely they are to say yes, and the message to send.

Next.js 16 · React 19 · React Three Fiber · Supabase (Postgres + Auth) · Claude, OpenAI, Gemini and more (bring your own key) · OpenStreetMap

---

## Features

### 🗺️ Scan any neighbourhood

Type a place ("Koramangala, Bengaluru", "Shoreditch, London"), pick a radius and categories, and launch. The app finds the businesses worth pitching and analyses up to 100 of them in depth.

**How it works** (`src/lib/discovery.ts`, `src/lib/categories.ts`)
- Nominatim geocodes the area and detects the country, which sets the currency (₹, £, $…).
- One Overpass (OpenStreetMap) query lists named businesses across ~30 categories (restaurants, clinics, salons, gyms, law firms, real estate…), mapped from OSM tags in a category knowledge base.
- Businesses that won't hire a freelancer are filtered out:
  - **chain outlets**: marketing is decided at head office
  - **institutional places**: campus canteens, government offices, university departments
- The final pick is spread **round-robin across categories**, and favours businesses you can actually contact (phone, email, website or social).
- Public Overpass servers are often overloaded, so the query rotates across several servers with back-off. A failed scan can be retried from its page.

### 🔍 A website audit for every business

Each business gets a pass/fail checklist: is the site live, secure, mobile-friendly, fast, findable on Google, tracking visitors, taking bookings or orders, and recently updated?

**How it works** (`src/lib/crawler.ts`)
- The crawler fetches the homepage plus up to 4 high-value pages (menu, booking, pricing, contact…) and parses them with cheerio.
- It detects:
  - HTTPS, mobile viewport, response time, title and meta description, Open Graph, schema.org types
  - **tech stack**: WordPress, Wix, Shopify, Squarespace, Next.js…
  - **analytics**: GA, GTM, Meta Pixel…
  - **booking and ordering tools**: Calendly, OpenTable, Practo, Zomato…
  - e-commerce, chat widgets, social links, emails, phone numbers and the copyright year
- Website addresses come from crowd-sourced map data, so every URL is resolved first and **private-network addresses are refused**.
- Errors are rewritten in plain language ("the domain no longer resolves (it may have expired)") so they can go straight into a pitch.

### 📊 Revenue, scores and customer insight

Every business gets an estimated annual revenue range, six 0–100 scores (opportunity, urgency, budget fit, digital maturity, visibility, reputation), a customer mix and a list of fixable gaps.

**How it works** (`src/lib/heuristics.ts`, `src/lib/market.ts`, `src/lib/insights.ts`)
- A **built-in scoring engine** runs for every business, for free, even without any API key.
- **Revenue** = the category's baseline × size (review volume, chain status, site depth) × price tier × the country's purchasing power, converted to local currency.
- **Opportunity** weighs how urgent the gaps are (scaled by how much the category relies on online search), whether they can pay, whether you can reach them, and their reputation. Chains are penalised.
- **Services** come from a catalogue of 14 freelance offers (website, redesign, booking system, online ordering, local SEO, WhatsApp automation, CRM…). Each is priced for the local market. Its **acceptance probability** rises when it fixes a visible problem, costs a tiny share of the business's revenue, and is quick to deliver.
- `insights.ts` turns all this into the short facts the UI shows: a one-line verdict, number-led key insights, and the website checklist.

### 🤖 AI research and pitch writing, on your own AI account

With an AI provider connected, each business gets real web research and a pitch written for that business specifically:
- review themes and follower counts
- delivery-app commissions
- owner details and competitors

The brief includes talking points, objection handling, the best channel and time to reach out, and a ready-to-send message.

| Analysis depth | What happens |
|---|---|
| **Deep research** | The model searches the web for each business, then writes the brief |
| **AI brief** | The model writes the brief from the website audit and map data (no web search) |
| **Engine only** | The built-in engine. Free, fast, no key needed |

**How it works** (`src/lib/ai.ts`, `src/lib/llm/`)
- **Supported AI providers**: Anthropic Claude, OpenAI, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, or any OpenAI-compatible endpoint. Each user chooses one and the model.
- **Adapted per provider and model**:
  - **Claude** uses the official SDK with adaptive thinking, effort, native structured output and server-side web search and fetch. Options are matched to the chosen model family, with a conservative path for older models.
  - **OpenAI** uses strict JSON-schema output and the Responses API web-search tool.
  - **Gemini** uses JSON mode and Google Search grounding.
  - **OpenAI-compatible providers** use JSON mode, with a fallback for models that don't support it.
- **Research without built-in search**: the app runs targeted searches through the user's Tavily, Brave or Serper key, reads the top pages, and the model writes notes from that evidence.
- **Every answer is validated** against one Zod report schema. If it doesn't match, the model gets one automatic repair round with the validation errors.
- The engine's numbers go to the model as a starting point, so AI reports stay grounded.
- If the AI fails (bad key, quota, refusal), the business keeps its engine report, and the activity feed says why ("OpenAI rejected your API key…").
- If research turns up a website the map didn't list, that website is crawled and audited too.

### ⭐ Ratings and reviews

Connect **Google Places** or **Yelp Fusion** to add star ratings, review counts, price level and recent review text. These sharpen the size, revenue and reputation estimates.

**How it works** (`src/lib/places.ts`)
- Each business is matched near its map location, with a name check so Yelp's fuzzy search doesn't pick the wrong place.
- Price tiers from both providers are mapped onto one scale.

### 📋 A numbers-first business brief

The business page is built to be scanned, not read:
- **The top**: a one-line **verdict** ("Hot lead: pitch online booking, 64% likely yes") and a six-number KPI strip (revenue, deal size, win chance, digital, visibility, rating).
- **Key insight cards**: each a big stat with a few words of context ("© 2019 · site untouched for 5 years").
- **The pitch**: the most likely "yes" offer with a win-chance ring, plus the other offers as compact rows that expand on tap.
- **A tabbed pitch kit**: message (with Copy), talking points, objections and approach.
- **Business health**: the website checklist, customer mix bar, social channel tiles and a competition stat.
- **Evidence**: research notes with sources, crawl data and reviews, collapsed until needed.

### 🛰️ Live progress and a 3D lead map

Scans run in the background while you watch: a progress bar, a live activity feed, and lead cards that fill in as each business is scored. A **3D constellation** plots every lead by opportunity × digital maturity × revenue: drag to orbit, hover for details, click to open.

**How it works** (`src/lib/pipeline.ts`)
- An in-process job runner analyses each scan's businesses in parallel (`ANALYSIS_CONCURRENCY`).
- Every stage is saved to Supabase: crawling, enriching, scoring, researching, writing.
- Pages poll for progress every 2.5 seconds.
- If the server restarts, unfinished scans resume where they stopped.
- **Zero-downtime deploys**: on shutdown the old server stops taking new work, and the new one waits briefly (`RESUME_DELAY_MS`) before resuming. A scan is never processed, or billed, twice.

### 👤 Accounts, profiles and guest mode

- **Sign up in two steps**:
  1. The account: name, email and password, with a strength meter. A duplicate email is caught as soon as you click Continue.
  2. An optional "About you" step: phone, role, location, experience, portfolio, skills and interests.
- **Profile page**: edit your details and manage your API keys.
- **Try it free**: anyone can use the app as a guest, with no signup. Guests get engine-only scans of up to 10 businesses, and their results are kept for 24 hours. Signing up keeps everything they ran.

**How it works** (`src/proxy.ts`, `src/app/(auth)/`, `src/app/api/account/`)
- **Supabase Auth** handles email and password, email confirmation, and forgot/reset password. `proxy.ts` (Next 16's request-interception file) refreshes the session on every page and protects private routes.
- **Guests** are Supabase **anonymous users**, so every security rule applies to them unchanged.
- **Keeping guest results**:
  - Signing up attaches an email and password to the same user ID, so nothing has to move.
  - Logging into an existing account moves the guest's scans there with `transfer_guest_data()`, after the server verifies the guest session.
- **Clean-up**: an hourly job deletes guests older than `GUEST_RETENTION_HOURS`, and their scans go with them.

### 🔐 Your keys and data stay private

- **Row-level security on every table**: each user can only read their own scans, businesses and activity. Child rows inherit their owner from the parent scan through a trigger, so ownership can't drift.
- **Only the server writes results.** Scans are created server-side after limits are checked (`DAILY_BUSINESS_LIMIT`, guest limits). Users can't insert or edit results directly through the Supabase API.
- **API keys are encrypted with AES-256-GCM** before storage (`src/lib/crypto.ts`). They live in a table with no client access at all, are decrypted only in memory while a scan runs, and are never sent back to the browser, which only sees a hint like `sk-…a1b2`.
- **Password-locked key management**: changing keys needs your password again, which unlocks key management for 15 minutes through a signed, httpOnly cookie. Wrong attempts are rate-limited.
- **Every key is tested** against its provider before it's saved. For AI providers, the live model list comes back, so you only pick models that exist.

### ✨ An interface that feels alive

- **Landing page**: an interactive dotted globe. Dots swell and light up under the cursor, a click sends a ripple across it, and the globe tilts toward the pointer.
- **Across the site**: a soft cursor light, cards that glow at their edges where you hover, buttons that pull gently toward the cursor, and parallax hero text.
- **Loading**: layout-matched skeletons with one shared shimmer, shown instantly on navigation through `loading.tsx`.
- **Accessibility**: motion is reduced for users who ask for it, and touch devices get the plain interface.

---

## Architecture

```
 Browser (React, R3F scenes, polling)
    │  fetch /api/*  (+ Supabase session cookie)
    ▼
 Next.js server (Render)
    ├─ proxy.ts ............ session refresh, route protection
    ├─ API routes .......... auth check → read via the user's client (RLS) → enqueue work
    └─ Pipeline worker ..... background scans (admin client)
           ├─► Nominatim + Overpass (OpenStreetMap) ... discovery
           ├─► business websites ...................... crawl + audit
           ├─► Google Places / Yelp ................... ratings (user's key)
           ├─► Claude / OpenAI / Gemini / … ........... research + brief (user's key)
           └─► Tavily / Brave / Serper ................ web search (user's key)
                          │
                          ▼
                Supabase Postgres + Auth (RLS on every table)
```

**Database** (`supabase/migrations/`):

| Table / view | Holds |
|---|---|
| `profiles` | One row per user, created by a signup trigger |
| `scans` | Each search |
| `businesses` | Everything learned about each business: crawl, ratings, research, report |
| `scan_events` | The live activity feed |
| `user_settings` | Each user's chosen providers |
| `api_keys` | Encrypted keys |
| `scan_overview` | A view with per-scan counters |

## Tech stack

| Area | Tools |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| UI | Tailwind CSS 4, Framer Motion, React Three Fiber + drei, lucide icons |
| Data & auth | Supabase (Postgres, Auth, RLS) via `@supabase/ssr` |
| AI | Anthropic TypeScript SDK; REST clients for OpenAI-compatible APIs and Gemini; Zod validation |
| Data sources | OpenStreetMap (Nominatim, Overpass), cheerio, Google Places, Yelp, Tavily, Brave, Serper |
| Hosting | Render (one long-running Node service) |

---

## Getting started (local)

Needs Node 22+ and Docker (for the local Supabase stack).

```bash
npm install
npm run db:start             # Supabase in Docker; applies supabase/migrations
cp .env.example .env.local   # fill in the values printed by db:start
npm run dev                  # http://localhost:3000
```

Local Supabase extras:
- `npx supabase status` prints the URL and keys again.
- Studio, for browsing tables and users: http://127.0.0.1:54323
- Test inbox for confirmation and reset emails: http://127.0.0.1:54324
- Email confirmation is off locally, so signup logs you straight in.

| Script | Does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm run check:setup` | Checks `.env.local` against your Supabase project: keys, tables, permissions, guest mode, encryption secret |
| `npm run db:start` / `db:stop` | Start or stop local Supabase (data is kept) |
| `npm run db:link` / `db:push` | Link a hosted project / apply migrations to it |
| `npm run db:reset` | Rebuild the local database from migrations. **Wipes local data** |

### Configuration

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable key (`sb_publishable_…`). Safe in the browser, because RLS protects the data |
| `SUPABASE_SECRET_KEY` | yes | Secret key (`sb_secret_…`). Server only: the worker writes results and reads encrypted keys with it |
| `KEYS_ENCRYPTION_SECRET` | yes | 32+ random characters that encrypt users' API keys. **Back it up**: changing it makes saved keys unreadable |
| `NEXT_PUBLIC_SITE_URL` | prod | Your live URL (sent to OpenRouter as the referring site) |
| `OSM_CONTACT_EMAIL` | recommended | Contact in the OpenStreetMap User-Agent, as their usage policy asks |
| `ANALYSIS_CONCURRENCY` | no | Businesses analysed in parallel (default 3) |
| `DAILY_BUSINESS_LIMIT` | no | Businesses per user per 24 h (default 150) |
| `GUEST_DAILY_BUSINESS_LIMIT` / `GUEST_RETENTION_HOURS` | no | Guest allowance (default 30) and how long guest data is kept (default 24 h) |
| `RESUME_DELAY_MS` | no | Wait before resuming scans after boot (default 45 s in production) |

AI, ratings and search keys are **not** environment variables: each user adds their own on the Profile page.

## Hosted Supabase

1. **Create a project** at https://supabase.com/dashboard.
2. **Copy the keys** from **Project Settings → API Keys** into `.env.local`: the Project URL, the publishable key and the secret key. Projects that only show the legacy keys also work: use `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
3. **Create the tables**: run `npx supabase login`, then `npm run db:link -- --project-ref <ref>`, then `npm run db:push`. Or paste each file in `supabase/migrations/` into the SQL Editor, oldest first.
4. **Auth URLs**: under **Authentication → URL Configuration**, set the Site URL to your app's URL and add `http://localhost:3000/**` (and your live domain + `/**`) to Redirect URLs.
5. **Guest mode**: under **Authentication → Sign In / Providers**, enable **Allow anonymous sign-ins**. Before launch, also turn on CAPTCHA under **Attack Protection**.
6. **Email settings**: set the minimum password length to 8. The built-in mailer only sends a few emails per hour, so add custom SMTP before real users sign up, or turn "Confirm email" off while testing alone.
7. **Check**: run `npm run check:setup`, then restart `npm run dev`.

## Deploy to Render

Scans run in the background inside the server, so the app needs an always-on host, not serverless. `render.yaml` describes the whole service.

1. Push the repo to GitHub. `.env.local` is git-ignored.
2. In Render choose **New → Blueprint** and pick the repo. It creates:
   - a 512 MB service with the build and start commands
   - the `/api/health` check
   - a single instance
   - a 120 s shutdown window for safe redeploys
3. Fill in the secrets:
   - the three Supabase values
   - `KEYS_ENCRYPTION_SECRET`: use the same value as `.env.local`
   - `NEXT_PUBLIC_SITE_URL` and `OSM_CONTACT_EMAIL`
4. In Supabase, add `https://<your-app>.onrender.com` as the Site URL and `https://<your-app>.onrender.com/**` as a Redirect URL.
5. Open `/api/health`: it should return `{"ok":true}`.

**Sizing**: measured at ~160 MB idle and ~340 MB with two 25-business scans running at once, using the settings in `render.yaml`. Builds run on Render's 8 GB build machines. Choose the region closest to your Supabase project before the first deploy. Switch to `1c-2g` if many users scan at the same time. Avoid the free plan: it sleeps when idle, which pauses scans.

## Project structure

```
src/
  app/                    pages, loading skeletons and API routes
    (auth)/               login, signup, forgot/reset password
    api/                  scans, businesses, profile, account (unlock, keys, models, settings, claim-guest), health
  components/
    three/                HeroScene (globe), Constellation (3D lead map), ScoreOrb
    auth/, profile/       auth forms, key vault, profile form
  lib/
    discovery.ts          Nominatim + Overpass
    crawler.ts            website audit
    categories.ts         category knowledge base + service catalogue
    market.ts             purchasing-power scaling + currency
    heuristics.ts         scoring engine + report builder
    insights.ts           verdict, key insights, website checklist
    ai.ts                 research + brief (provider-agnostic)
    llm/                  Anthropic, OpenAI-compatible and Gemini clients + JSON validation
    places.ts, search.ts  Google Places / Yelp, Tavily / Brave / Serper
    keys.ts, crypto.ts    encrypted per-user keys and settings
    pipeline.ts           background job runner
    db.ts, supabase/      data access + browser, server and admin clients
  proxy.ts                session refresh + route protection
supabase/migrations/      schema, RLS policies, triggers, guest functions
scripts/check-setup.mjs   environment and database checker
render.yaml               Render blueprint
```

## Limitations

- **Revenue and prices are estimates** built from category baselines, size signals and coarse purchasing-power factors. Use them as a guide, not a quote.
- **Social follower counts aren't scraped.** Channels show as "active" when linked, and "strong" only when AI research found evidence.
- **OpenStreetMap coverage varies by area.** Websites and phone numbers are often missing, especially outside Europe and North America. Deep research and a ratings key fill most of those gaps.
- **One server instance.** The worker runs inside it. Scaling to several instances would need a separate queue-based worker.

Map data © OpenStreetMap contributors (ODbL).
