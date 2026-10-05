# AnnSetu · अन्नसेतु

**The bridge between farm and buyer.** Farmers list their produce and keep an exact record of what is sold, reserved in orders, unsold or spoiled. Households and businesses buy straight from farms that can reach them fresh, and pay cash on delivery. The whole app works in English and Hindi.

A non-commercial college project, built entirely with free and open-source tools.

## What it does

**Farmers**
- Get a dashboard with earnings, unsold stock value, orders to act on, sold-vs-unsold per listing, and weekly earnings. Every chart can also be viewed as a table.
- List produce by typing its name any way they say it ("tomato", "tamatar", "टमाटर", even "tamatr"). Add photos, price, minimum order, when it was picked, how far they deliver, and the organic flag. Pause or archive a listing.
- Get a **suggested price** between the mandi rate and the shop price, with every step of the sum shown.
- Keep a stock log per listing: listed, restocked, reserved for an order, released, sold, spoiled, corrected.
- Receive orders **live**: accept them with a promised delivery time, then pack, send and mark delivered. Household orders arrive as **shared trips** grouped by PIN code. Rejecting or cancelling releases the stock.
- See a **Demand** panel of buyer requests mapped to their farm: ones they can fill now, ones within reach, and ones out of reach. "List this" opens a prefilled listing.
- Set up a profile with farm details, crops, delivery distance and GPS location on an OpenStreetMap map.

**Buyers (households and businesses)**
- Search the market in English, Hinglish or Hindi, with typos forgiven. Results are only farms that can deliver to them fresh, best match first. Each card shows the price with delivery, freshness on arrival, the farm's on-time record and distance, and **Why this order?** explains the ranking.
- Households in the same PIN code **share one delivery trip**. A business pays for one trip of its own.
- See listing details with the farmer's public profile and ratings.
- Use a cart that holds items from several farmers; checkout quotes the delivery fee and turns the cart into one order per farmer. Payment is cash on delivery.
- Track orders on a live timeline, cancel while an order is still new, waiting for neighbours or accepted, and rate it after delivery.
- Post requirements (bulk buying for restaurants, shops, mills, canteens), which reach farmers' demand panels.

## Architecture

```
 Browser: static Next.js app on GitHub Pages (no server of its own)
   │  @supabase/supabase-js (JWT session in localStorage)
   ├──► Supabase Auth ───── email + password, any number of users signed in at once
   ├──► PostgREST ───────── tables protected by row-level security (RLS)
   ├──► Postgres functions ─ match_listings · quote_delivery · place_order · update_order_status · adjust_stock · …
   ├──► Realtime ─────────── new orders / status changes pushed to the open page
   └──► Storage ──────────── produce photos and avatars (compressed in the browser first)
 Browser ──► OpenStreetMap tiles + Nominatim (GPS → address, only when the user taps "Use my location")
 GitHub Actions ──► build + deploy on every push · daily mandi prices from Agmarknet · a ping every 3 days keeps Supabase awake
```

There is no server code to protect, so security lives in the database:
- **RLS policies** decide which rows each user can read or change.
- **Column privileges** stop the browser from editing stock counters, roles, orders or prices directly.
- `SECURITY DEFINER` functions are the only way to place an order, move it through its states, or change stock. They lock the rows they touch in a fixed order, so two buyers cannot both buy the last kilo and concurrent orders cannot deadlock.

| Concern | Tool |
|---|---|
| App | Next.js 16 (static export), React 19, TypeScript |
| UI | Tailwind CSS 4, Radix UI primitives (shadcn-style), lucide-react icons, sonner toasts |
| Data | Supabase (Postgres, Auth, Storage, Realtime), TanStack Query |
| Maps | Leaflet + react-leaflet, OpenStreetMap tiles, Nominatim reverse geocoding |
| Prices | Agmarknet daily mandi prices via the data.gov.in API (free key) |
| Charts | Recharts |
| i18n | i18next + react-i18next (`src/locales/en.json`, `hi.json`) |
| Fonts | Anek Devanagari + Mukta (Google Fonts, self-hosted by `next/font`) |
| Tests | Vitest + PGlite (Postgres in WASM) for the engine and database rules, Playwright for end to end |
| Hosting | GitHub Pages (free) + Supabase free tier |

## Try it without any setup: demo mode

Until a Supabase project is connected, AnnSetu runs in **demo mode**: the whole database (every migration, security rule and function in `supabase/migrations`) runs inside the browser in [PGlite](https://pglite.dev), Postgres compiled to WebAssembly, and is saved in that browser's storage. Sign up, list produce, order, accept and deliver: everything works, for anyone opening the site.

- A banner says so on every page. Data stays in that one browser, so two people on two phones don't see each other; take turns in one browser (sign out, sign in as the other person), or connect Supabase.
- The first visit downloads PGlite from the jsDelivr CDN (about 5 MB) and sets up the database in a few seconds; later visits open it from storage.
- So the market isn't empty, demo farms appear around Jaipur on the first visit, and around anyone who saves an address or taps **Show farms near me**. They're marked by an `@annsetu.demo` email and nobody can sign in as them.
- No emails are sent in demo mode, so "Forgot password" explains that instead.
- Open in one tab at a time; a second tab says the demo is open elsewhere.

Connecting Supabase (below) switches demo mode off; nothing else changes.

## Set it up

### 1. Supabase (database + login)

Until this is done, the site says it isn't connected to its database.

1. Create a free project at [supabase.com](https://supabase.com) (region: Mumbai is closest).
2. **SQL Editor → New query**, paste the whole of [`supabase/setup.sql`](supabase/setup.sql), and **Run**. This creates the tables, the 80-item catalogue, security rules, the matching engine, photo buckets and realtime. Run it once, on a new project.
3. **Authentication → Sign In / Providers**: turn **Confirm email** off for the project demo. Supabase's built-in mailer sends only a few emails, to your own team. To keep confirmation on, add a free SMTP provider under **Authentication → Emails → SMTP** (for example Brevo, 300 emails a day).
4. **Authentication → URL Configuration**:
   - **Site URL**: `https://<your-github-user>.github.io/<repo-name>/`
   - **Redirect URLs**: add `https://<your-github-user>.github.io/<repo-name>/**` and `http://localhost:3000/**`
5. Copy the **Project URL** (Project Settings → Data API) and the **publishable** key (Project Settings → API Keys; the legacy `anon` key works too). Both are public by design. Never put the secret / `service_role` key in the app.

### 2. Run it locally

```bash
cp .env.example .env.local   # then paste the URL and publishable key
npm install
npm run dev                  # http://localhost:3000
```

### 3. Deploy to GitHub Pages

1. Push this folder to a GitHub repository. It must be public for free GitHub Pages.
2. **Settings → Secrets and variables → Actions → Variables**: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key). Repository secrets with the same names work too.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main`. The **Deploy to GitHub Pages** workflow runs the checks and tests, builds the static site with the right base path, and publishes it to `https://<user>.github.io/<repo>/`.

The **Keep Supabase awake** workflow reads one row every three days, so the free project doesn't pause after a week of no traffic. GitHub switches scheduled workflows off after 60 days without any commit; re-enable it from the Actions tab if that happens.

### 4. Live mandi prices (optional)

Price suggestions and the price part of the match score start from **sample prices** (marked as such in the app). For real ones, add three **repository secrets**:

| Secret | Where from |
|---|---|
| `DATA_GOV_IN_API_KEY` | A free account on [data.gov.in](https://data.gov.in) → My Account → API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **secret** key. It lives only in GitHub secrets; it never goes in the app or the repository |
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL (if not already a variable) |

The **Mandi prices** workflow then runs every evening (and on demand from the Actions tab). It fetches the day's Agmarknet prices, takes the median modal price per item for each district, state and the whole country (rupees per quintal ÷ 100 = per kg), and saves them. If the feed is down, the last good prices stay. A price older than 30 days is ignored. The shop price is estimated from the mandi price with a markup per category (`engine_settings.shop_markup`, from RBI farmers'-share studies) until someone enters real shop prices in `reference_prices` with source `manual`.

## Matching engine

Built from the design doc *ANN Setu: Matching Algorithms*. Five steps, each in the database (the source of truth) and mirrored in TypeScript (the reference that tests check the database against):

| Step | What it does | Database | TypeScript |
|---|---|---|---|
| 1. Search | Any spelling → one catalogue item. A name scores the better of trigram overlap and edit closeness (a swapped letter pair counts as one typo), with Devanagari nukta and chandrabindu normalised. Names at 0.55 or more are offered; a non-exact match is only ever a "did you mean". | the 80-item catalogue, 485 spellings | `src/lib/matching/search.ts` |
| 2. Hard rules | A listing is shown only if: same item, active, farmer verified (when required), within both the buyer's distance and the farm's delivery radius, the order meets the minimum, there is enough stock (a household needs its full amount; a business may split), it arrives with at least 40% of its shelf life left (hours since picking + travel ≤ 0.6 × shelf life), and no area rule hides it today. | `match_listings`, `match_hidden` | `src/lib/matching/engine.ts` |
| 3. Score | Weighted parts, each 0 to 1: price against the local shop (`1.5 − price/shop`), freshness on arrival, nearness, on-time record (`(on time + 8) / (completed + 10)`, so new farmers start at 0.8), and how much of the order it fills. Households weigh price and freshness; businesses weigh price, reliability and fill. | `match_listings` | `engine.ts` |
| 4. Live stock | The list is read live. The order reserves stock in one step under row locks, re-checking the rules at order time. | `place_order` | |
| 5. Rate | Lowest fair price = mandi; highest = shop − delivery per unit; the farmer gets half the room between them, nudged by local demand (only with 20+ open requests, at most a quarter of the room), cut as produce ages and for big lots (5% per 100 units, at most 5%), and kept within the bounds. | `rate_inputs` | `src/lib/matching/rate.ts` |

**Shared trips for households.** Household orders to one farm and one PIN code wait in a delivery batch. A trip costs `2 × 1.3 × km × ₹10` (there and back, road distance, with km rounded to whole kilometres so exact locations stay private). Each household's saving is what it would have paid the shop minus what it pays the farm. The batch goes to the farmer as soon as the households' savings together cover the trip; the trip cost is then split in proportion to each household's saving, in whole paise that add up exactly to the trip cost. If that doesn't happen within 24 hours, the batch goes anyway, marked "below break-even": each household pays its saving and no more, and the farmer sees the total before deciding. Either way, **no household ever pays more than the shop for the same goods, delivery included**, and checkout shows the most it can pay ("up to ₹X"). A business order is one trip of its own and goes straight to the farmer.

**Area rules, never people.** Festival-time or local rules (hide an item, or nudge demand up or down) are set by an admin for an area and a date range in `area_rules`. The engine never guesses or stores anything about a buyer as a person; the only buyer preferences are ones the buyer states.

**Settings** live in one row, `engine_settings`, editable later without a code change:

| Setting | Default | Setting | Default |
|---|---|---|---|
| Road factor | 1.3 | Household / business max distance | 25 / 100 km |
| Speed | 30 km/h | Farm delivery radius | 40 km |
| Freshness limit | 0.6 of shelf life | Require verified farmers | off |
| Cost per road km | ₹10 | Batch window | 24 h |
| Farmer's share of the room | 0.5 | Search cut-off | 0.55 |
| Demand nudge | ±¼ room, from 20 requests | Big-lot cut | 5% per 100 units, max 5% |
| Household weights | price .30 · fresh .30 · near .20 · trust .20 | Business weights | price .35 · fresh .10 · near .05 · trust .30 · fill .20 |

**Tested** (`npm test`, `npm run test:db`):
- **Rate**: the doc's examples reproduce exactly (₹24.90, 30.07, 22.31, 19.72, 22.83, 26.35). The price stays within mandi and shop − delivery, and moves the right way, across 200,000 random cases.
- **Search**: one typo finds the right item in the top three 100% of the time, and two typos 91.5% of the time (2,000 tries each). All 42 real-world spellings work.
- **Database vs reference**: across 2,000 random requests (18,000+ listings shown), the database and the TypeScript reference agree. No listing broke a rule, none was wrongly left out, and the order and scores were identical.
- **Doc cases**: the restaurant trip (₹520), spinach shown at 50 km and hidden at 60 km, a batch releasing at the 8th household, the cut-off release, cancellations shrinking a batch, trust 9/13, and the one-step reserve leaving exactly 1 kg.
- **Busy-morning simulation** (320 buyers): without the engine, 16% of buyers are served, with phantom stock. With the live list and one-step reserve, 100% are served.
- **Speed**: 90,000 active listings, 95% of requests answered under 31 ms.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Static export to `out/` |
| `npm run check` | Typecheck, lint, translation parity, colour contrast, database tests, engine tests |
| `npm test` | Matching engine: search, rules, score, rate, the database against the reference, the doc's cases, speed, the price feed |
| `npm run test:db` | Runs every migration on in-memory Postgres and checks 58 rules: order flow, stock maths, who can see and change what |
| `npm run test:e2e` | Playwright: a farmer, a restaurant and a household trade end to end. In demo mode they take turns in one browser (`e2e/demo.spec.ts`); with `E2E_SUPABASE=1` and a Supabase project they use three browsers at once. `E2E_CHANNEL=msedge` uses the installed Edge |
| `npm run check:i18n` | Every English key has a Hindi twin, and every key used in code exists |
| `npm run check:contrast` | Every text/background token pair meets WCAG AA in light and dark |
| `npm run db:bundle` | Rebuilds `supabase/setup.sql` from `supabase/migrations/` |
| `npm run db:catalogue` | Rebuilds the catalogue migration from `supabase/catalogue.json` |
| `npm run prices:fetch` | Fetches today's mandi prices (needs the secrets above; `PRICE_FEED_DRY_RUN=1` only prints) |
| `npm run ds:build` | Rebuilds the design-system artifact files from the code (tokens, docs, component bundle) |

## Design system

The AnnSetu design system has three views of one source:

- **Tokens**: [`src/styles/tokens.css`](src/styles/tokens.css) is the source of truth, mapped to Tailwind utilities in `src/app/globals.css`.
- **Living style guide**: the `/design-system` page of the app. Every component, live, with role, language and theme switches.
- **Design System artifact**: [AnnSetu Design System](https://claude.ai/artifact/RTTv9J6cPiYetjfsTUH7Fu). Brand book, tokens, and 41 components with guidelines and live previews, generated from this code by `npm run ds:build` (`design-system/`).

The short version:
- **Field green (khet)** marks the farmer's side, **indigo (neel)** the buyer's, and **turmeric (haldi)** demand and attention.
- **Anek Devanagari** with **Mukta**, both covering Latin and Devanagari.
- **48px touch targets**, never color alone, a unit on every number.

## Project layout

```
src/app/                 routes: / (landing), (auth)/*, onboarding, farmer/*, (buyer)/* (market, cart, checkout, orders, requirements, profile), design-system
src/components/ui/       base components (button, field, dialog, tabs, table, …)
src/components/domain/   AnnSetu components (stock bar, produce card, item picker, match card, order card, demand card, …)
src/components/forms/    produce, profile, stock and avatar forms, rate suggestion
src/lib/matching/        the engine's TypeScript reference: search, rules + score, rate, units, settings
src/lib/                 supabase client, api, auth, i18n, cart, geo, types
src/locales/             en.json, hi.json
src/styles/tokens.css    design tokens
supabase/migrations/     schema, functions, security, storage + realtime, matching engine, catalogue
supabase/catalogue.json  80 items: names in English, Hinglish and Hindi, units, shelf life, Agmarknet names
scripts/                 checks, database tests, catalogue + design-system builds, prices/ (mandi feed)
tests/                   engine tests against in-memory Postgres
e2e/                     Playwright test
.github/workflows/       deploy to Pages, mandi prices, keep Supabase awake
```

## Limits worth knowing (free tiers)

- **Supabase free tier**:
  - 500 MB database (hundreds of thousands of listings and orders)
  - 1 GB file storage and 5 GB egress (photos are compressed to about 150 KB, four per listing)
  - 50,000 monthly active users
- **Static hosting**: marketplace pages are rendered in the browser, so search engines see little of them. Fine for a college project.
- **Payments**: cash on delivery only. A payment gateway would be another `payment_method` and a server-side webhook.
- **Prices**: Agmarknet covers mandis, not shops; shop prices are estimates until real ones are entered. Shelf lives in the catalogue are estimates too.
- **Batches** are released when someone places or opens orders, and every 10 minutes where `pg_cron` is enabled (Database → Extensions in Supabase).
