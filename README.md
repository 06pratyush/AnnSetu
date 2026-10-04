# AnnSetu · अन्नसेतु

**The bridge between farm and buyer.** Farmers list their produce and keep an exact record of what is sold, reserved in orders, unsold or spoiled. Households and businesses buy straight from the farm and pay cash on delivery. The whole app works in English and Hindi.

A non-commercial college project, built entirely with free and open-source tools.

## What it does

**Farmers**
- Get a dashboard with earnings, unsold stock value, orders to act on, sold-vs-unsold per listing, and weekly earnings. Every chart can also be viewed as a table.
- List produce (photos, price per unit, minimum order, harvest and best-before dates, organic flag), pause it or archive it.
- Keep a stock log per listing: listed, restocked, reserved for an order, released, sold, spoiled, corrected.
- Receive orders **live**, then accept, pack, send for delivery and mark delivered. Reject or cancel releases the stock.
- See a **Demand** panel of open buyer requirements, with "List this" to create a listing prefilled from the request.
- Set up a profile with farm details, crops, and GPS location on an OpenStreetMap map.

**Buyers (individual and industrial)**
- Browse a marketplace of every farmer's listings, with search, category, organic and price sorting.
- See listing details with the farmer's public profile and ratings.
- Use a cart that holds items from several farmers; checkout turns it into one order per farmer. Payment is cash on delivery.
- Track orders on a live timeline, cancel while an order is still new or accepted, and rate it after delivery.
- Post requirements (bulk buying for restaurants, shops, mills, canteens), which farmers see on their demand panel.

## Architecture

```
 Browser: static Next.js app on GitHub Pages (no server of its own)
   │  @supabase/supabase-js (JWT session in localStorage)
   ├──► Supabase Auth ───── email + password, any number of users signed in at once
   ├──► PostgREST ───────── tables protected by row-level security (RLS)
   ├──► Postgres functions ─ place_order · update_order_status · adjust_stock (atomic, row-locked)
   ├──► Realtime ─────────── new orders / status changes pushed to the open page
   └──► Storage ──────────── produce photos and avatars (compressed in the browser first)
 Browser ──► OpenStreetMap tiles + Nominatim (GPS → address, only when the user taps "Use my location")
 GitHub Actions ──► build + deploy on every push; a ping every 3 days keeps the free Supabase project awake
```

There is no server code to protect, so security lives in the database:
- **RLS policies** decide which rows each user can read or change.
- **Column privileges** stop the browser from editing stock counters, roles or orders directly.
- The three `SECURITY DEFINER` functions are the only way to place an order, move it through its states, or change stock. They lock the rows they touch, so two buyers cannot both buy the last kilo.

| Concern | Tool |
|---|---|
| App | Next.js 16 (static export), React 19, TypeScript |
| UI | Tailwind CSS 4, Radix UI primitives (shadcn-style), lucide-react icons, sonner toasts |
| Data | Supabase (Postgres, Auth, Storage, Realtime), TanStack Query |
| Maps | Leaflet + react-leaflet, OpenStreetMap tiles, Nominatim reverse geocoding |
| Charts | Recharts |
| i18n | i18next + react-i18next (`src/locales/en.json`, `hi.json`) |
| Fonts | Anek Devanagari + Mukta (Google Fonts, self-hosted by `next/font`) |
| Tests | PGlite (Postgres in WASM) for the database rules, Playwright for end-to-end |
| Hosting | GitHub Pages (free) + Supabase free tier |

## Set it up

### 1. Supabase (database + login)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste the whole of [`supabase/setup.sql`](supabase/setup.sql), and **Run**. This creates the tables, security rules, functions, photo buckets and realtime. Run it once.
3. **Authentication → Sign In / Providers → Email**: turn **Confirm email** off for the project demo. Supabase's built-in mailer sends only a few emails per hour. To keep confirmation on, add a free SMTP provider under **Authentication → Emails → SMTP** (for example Brevo, 300 emails a day).
4. **Authentication → URL Configuration**:
   - **Site URL**: `https://<your-github-user>.github.io/<repo-name>/`
   - **Redirect URLs**: add `https://<your-github-user>.github.io/<repo-name>/**` and `http://localhost:3000/**`
5. **Project Settings → API**: copy the **Project URL** and the **anon / publishable** key. Never use the `service_role` / secret key in this app.

### 2. Run it locally

```bash
cp .env.example .env.local   # then paste the URL and anon key
npm install
npm run dev                  # http://localhost:3000
```

### 3. Deploy to GitHub Pages

1. Push this folder to a GitHub repository. It must be public for free GitHub Pages.
2. **Settings → Secrets and variables → Actions → New repository secret**: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main`. The **Deploy to GitHub Pages** workflow runs the checks, builds the static site with the right base path, and publishes it to `https://<user>.github.io/<repo>/`.

The **Keep Supabase awake** workflow reads one row every three days, so the free project doesn't pause after a week of no traffic. GitHub switches scheduled workflows off after 60 days without any commit; re-enable it from the Actions tab if that happens.

## Your recommendation and matching logic

The app deliberately ships **without** any ranking or matching. Two hooks in [`src/lib/recommend/index.ts`](src/lib/recommend/index.ts) pass data straight through, and every page already calls them:

| Hook | Called by | Gets | Returns |
|---|---|---|---|
| `rankMarketplace(listings, ctx)` | Market page | the listings matching the buyer's filters, plus `BuyerContext` (signed in or not, buyer type, saved location, district/state, current filters) | the listings in the order to show them |
| `getFarmerSuggestions(ctx, openDemand)` | Dashboard panel, Demand page | `FarmerContext` (farm location, main crops, all their listings) and every open buyer request | `Suggestion[]`, each with an optional `score` and a one-line `reason` shown on the card |

Replace either function body; both may be `async`. Your logic can be plain TypeScript, a Postgres function you add and call with `supabase.rpc(...)`, or a request to your own API.

Listings and requests expose `approx_lat` / `approx_lng`, rounded to about 1 km for privacy, plus district and state. Your code also receives the viewer's own saved coordinates.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Static export to `out/` |
| `npm run check` | Typecheck, lint, translation parity, colour contrast, database tests |
| `npm run test:db` | Runs every migration on in-memory Postgres and checks 58 rules: order flow, stock maths, who can see and change what |
| `npm run test:e2e` | Playwright: a farmer and a buyer signed in at once trade end to end (needs a Supabase project with email confirmation off) |
| `npm run check:i18n` | Every English key has a Hindi twin, and every key used in code exists |
| `npm run check:contrast` | Every text/background token pair meets WCAG AA in light and dark |
| `npm run db:bundle` | Rebuilds `supabase/setup.sql` from `supabase/migrations/` |
| `npm run ds:build` | Rebuilds the design-system artifact files from the code (tokens, docs, component bundle) |

## Design system

The AnnSetu design system has three views of one source:

- **Tokens**: [`src/styles/tokens.css`](src/styles/tokens.css) is the source of truth, mapped to Tailwind utilities in `src/app/globals.css`.
- **Living style guide**: the `/design-system` page of the app. Every component, live, with role, language and theme switches.
- **Design System artifact**: [AnnSetu Design System](https://claude.ai/artifact/RTTv9J6cPiYetjfsTUH7Fu). Brand book, tokens, and 37 components with guidelines and live previews, generated from this code by `npm run ds:build` (`design-system/`).

The short version:
- **Field green (khet)** marks the farmer's side, **indigo (neel)** the buyer's, and **turmeric (haldi)** demand and attention.
- **Anek Devanagari** with **Mukta**, both covering Latin and Devanagari.
- **48px touch targets**, never color alone, a unit on every number.

## Project layout

```
src/app/                 routes: / (landing), (auth)/*, onboarding, farmer/*, (buyer)/* (market, cart, checkout, orders, requirements, profile), design-system
src/components/ui/       base components (button, field, dialog, tabs, table, …)
src/components/domain/   AnnSetu components (stock bar, produce card, order card, demand card, …)
src/components/forms/    produce, profile, stock and avatar forms
src/lib/                 supabase client, api, auth, i18n, recommend hooks, cart, geo, types
src/locales/             en.json, hi.json
src/styles/tokens.css    design tokens
supabase/migrations/     schema, functions, security, storage + realtime
scripts/                 checks, database tests, design-system build
e2e/                     Playwright test
.github/workflows/       deploy to Pages, keep Supabase awake
```

## Limits worth knowing (free tiers)

- **Supabase free tier**:
  - 500 MB database (hundreds of thousands of listings and orders)
  - 1 GB file storage and 5 GB egress (photos are compressed to about 150 KB, four per listing)
  - 50,000 monthly active users
- **Static hosting**: marketplace pages are rendered in the browser, so search engines see little of them. Fine for a college project.
- **Payments**: cash on delivery only. A payment gateway would be another `payment_method` and a server-side webhook.
