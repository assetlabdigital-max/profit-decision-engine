# Profit Decision Engine

A Next.js 14 SaaS app for Amazon product BUY / SKIP / RISK decisions, built
around one rule above all others: **the server must always boot and always
respond, even when every external service is missing or down.**

## Verified guarantees

This isn't aspirational — it was tested by building and booting the app with
**zero environment variables set** and exercising every route:

| Check | Result |
|---|---|
| `npm run build` with no `.env` | ✅ compiles clean, no warnings |
| `npm run start` with no `.env` | ✅ ready in <500ms |
| `GET /api/health` | ✅ `200`, reports all services as `mock` |
| `POST /api/scan` (no DB/Stripe) | ✅ `200`, returns mock verdict |
| `POST /api/scan` malformed JSON | ✅ `200`, falls back to a generic scan |
| `GET /dashboard` unauthenticated | ✅ `307` → `/login` (middleware works) |
| `POST /api/stripe/checkout` unauth | ✅ `401` with JSON error body |
| `POST /api/stripe/webhook` no Stripe configured | ✅ `200`, acknowledged as mock no-op |
| `GET /api/tiktok/trending` / `search` (no Apify) | ✅ `200`, deterministic mock data, clearly flagged `mock: true` |
| `POST /api/tiktok/refresh` unauthenticated | ✅ `401` |
| Any unhandled internal error | ✅ caught, returns `200` with `mock: true`, never `500` |

The one **deliberate, documented exception**: magic-link email sign-in
requires a database adapter to store one-time tokens — there is no safe way
to mock a round-trip token exchange. When `DATABASE_URL` is absent, the login
page shows a clear "sign-in temporarily unavailable" notice instead of
silently failing, and `/api/health` reports `emailSignInAvailable: false`.
Every other subsystem (scan results, Stripe checkout/portal/webhook, email
sending) has a genuine working mock fallback.

## Architecture

```
src/
├── middleware.ts              # EDGE runtime — session existence check only
├── auth/
│   ├── auth.config.ts         # EDGE-SAFE — providers: [], no Node imports
│   └── auth.ts                # NODE ONLY — pg adapter + Resend provider
├── lib/
│   ├── runtime-config.ts      # Single source of truth: is each service "live"?
│   ├── db/
│   │   ├── pool.ts            # NODE ONLY — lazy pg Pool, never throws on init
│   │   ├── safe-query.ts      # NODE ONLY — the only way to query Postgres
│   │   └── users.ts           # User/subscription repository, mock-aware
│   ├── stripe/
│   │   └── client.ts          # NODE ONLY — lazy Stripe client
│   ├── email/
│   │   └── send.ts            # NODE ONLY — Resend wrapper, logs instead of throwing
│   ├── scan/
│   │   ├── resolve-tier.ts    # Free/Pro resolution with JWT fallback
│   │   └── run-scan.ts        # Core scan logic, mock-data generation
│   ├── apify/
│   │   └── client.ts          # NODE ONLY — raw Apify REST wrapper, refresh-only
│   ├── tiktok/
│   │   ├── cache.ts           # NODE ONLY — the only DB read/write for trend data
│   │   ├── normalize.ts       # Defensive mapping of raw Apify JSON -> our shape
│   │   ├── refresh.ts         # Orchestrates: call Apify -> normalize -> cache
│   │   └── mock-data.ts       # Deterministic mock generators (Edge-safe)
│   └── mock/
│       └── mock-data.ts       # Deterministic mock generators (Edge-safe)
├── app/
│   ├── api/
│   │   ├── scan/route.ts              # NODE — the safety-critical endpoint
│   │   ├── auth/[...nextauth]/route.ts # NODE — wraps auth.ts handlers
│   │   ├── stripe/checkout/route.ts   # NODE — Checkout session creation
│   │   ├── stripe/portal/route.ts     # NODE — Billing portal session
│   │   ├── stripe/webhook/route.ts    # NODE — idempotent webhook receiver
│   │   ├── tiktok/trending/route.ts   # NODE — GET, cache-only, never calls Apify
│   │   ├── tiktok/search/route.ts     # NODE — GET, cache-only, never calls Apify
│   │   ├── tiktok/refresh/route.ts    # NODE — POST, the only Apify-calling route
│   │   └── health/route.ts            # NODE — live/mock status per subsystem
│   ├── dashboard/
│   │   ├── page.tsx                   # Protected by middleware
│   │   └── tiktok-trending-panel.tsx  # Client component, manual refresh button
│   ├── login/page.tsx
│   └── pricing/page.tsx
└── types/index.ts             # Shared types, Edge-safe

migrations/
├── 001_auth_tables.sql        # users / accounts / sessions / verification_token
├── 002_app_tables.sql         # scan_history / processed_stripe_events
└── 003_tiktok_cache_tables.sql # tiktok_trending_hashtags / tiktok_hashtag_videos / refresh log

scripts/migrate.js             # npm run db:migrate
```

### Why two auth files?

`auth.config.ts` is imported by **both** `middleware.ts` (Edge runtime) and
`auth.ts` (Node runtime). It contains `providers: []` and no Node-only
imports — Edge can safely import it. `auth.ts` then spreads `authConfig` and
adds the real Postgres adapter and Resend provider, neither of which Edge
can run. `middleware.ts` only ever imports `auth.config.ts`, never `auth.ts`.

### TikTok trend layer (Apify)

A second external dependency, wired with the same fallback shape as
everything else, but with one extra design constraint driven by cost and
latency: **Apify is never called on a user-facing read path.**

```
GET  /api/tiktok/trending     → always reads tiktok_trending_hashtags cache
GET  /api/tiktok/search       → always reads tiktok_hashtag_videos cache
POST /api/tiktok/refresh      → the ONLY route that calls Apify; authenticated,
                                 rate-limited (5 min cooldown per target),
                                 writes results into the cache tables
```

- `lib/apify/client.ts` — raw Apify REST wrapper (`run-sync-get-dataset-items`),
  never throws, only ever imported by `lib/tiktok/refresh.ts`.
- `lib/tiktok/normalize.ts` — defensively maps unpredictable raw Apify JSON
  field names (which vary across actors/versions) into our stable internal
  shape. A missing/renamed field becomes `null`, never a thrown error.
- `lib/tiktok/cache.ts` — the only DB read/write layer for trend data. Reads
  always return something usable: real cached rows, or deterministic mock
  data if the cache is empty/DB is down.
- A manual "Refresh from Apify" button on the dashboard is the only way to
  trigger a real fetch — there is no background cron in this version, by
  design, to keep Apify spend visible and operator-controlled. Switching to
  a scheduled refresh later just means calling `refreshTrendingHashtags()` /
  `refreshTiktokSearch()` from a cron route instead of a button click; the
  fallback logic underneath doesn't change.

Apify actor IDs are env-overridable (`APIFY_TIKTOK_SEARCH_ACTOR_ID`,
`APIFY_TIKTOK_TRENDING_ACTOR_ID`) since third-party actors get renamed,
deprecated, or replaced more often than a typical npm dependency — verify
the current actor on apify.com before relying on the defaults in
`.env.example`.

### The fallback pattern, consistently applied

Every external dependency follows the same shape:

1. `runtime-config.ts` decides — once, in one place — whether a service is
   "enabled" (env var present and `FORCE_MOCK_*` not set).
2. A thin client wrapper (`pool.ts`, `client.ts` for Stripe) lazily
   constructs the real client, wrapped in try/catch so construction itself
   can never throw.
3. A safe-call wrapper (`safeQuery`, route-level try/catch) guarantees the
   caller gets a discriminated result (`{ ok: true, ... } | { ok: false, ... }`)
   instead of a thrown error.
4. Callers branch on that result and substitute mock data — never an error
   page.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in whichever of DATABASE_URL / STRIPE_* / RESEND_API_KEY you have —
# the app runs fine with all of them blank.
npm run dev
```

### Database

```bash
npm run db:migrate   # applies migrations/*.sql in order, idempotently
```

Schema covers Auth.js's required tables (`users`, `accounts`, `sessions`,
`verification_token`) plus two app-specific tables:
- `scan_history` — best-effort analytics, write failures never block a scan response.
- `processed_stripe_events` — webhook idempotency guard, keyed on Stripe's event id.

### Stripe

Both **Checkout** (`/api/stripe/checkout`, monthly/yearly) and the
**Customer Portal** (`/api/stripe/portal`) are wired up. Point your Stripe
webhook endpoint at `/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET`.

Webhook idempotency: each Stripe event id is inserted into
`processed_stripe_events` via `INSERT ... ON CONFLICT DO NOTHING`. A
duplicate delivery returns `200 { duplicate: true }` without re-applying
side effects. If the DB itself is down during a webhook delivery, we cannot
safely dedupe — we process best-effort and log a warning rather than
retry-storming Stripe with 500s.

### TikTok trend data (Apify)

```bash
# .env.local
APIFY_API_TOKEN=apify_api_xxxxx
```

1. Create a free Apify account (no card required, includes trial credits).
2. Confirm the actor IDs in `.env.example` still exist/match your intended
   provider on apify.com — third-party actors change more often than
   first-party SDKs. Override `APIFY_TIKTOK_SEARCH_ACTOR_ID` /
   `APIFY_TIKTOK_TRENDING_ACTOR_ID` if you pick different ones.
3. Sign in, open `/dashboard`, click **"Refresh from Apify"** under
   TikTok trending hashtags. Each click costs Apify credits — there is a
   5-minute cooldown per target to prevent accidental double-spend.
4. `GET /api/tiktok/search?q=cooking&type=hashtag` reads the cache for a
   specific hashtag/keyword; populate it the same way via
   `POST /api/tiktok/refresh { "type": "search", "query": "cooking" }`.

Until you trigger a refresh, both read endpoints serve clearly-flagged
(`"mock": true`) deterministic demo data — useful for building the rest of
the product before spending any Apify credits.

### Testing fallback mode on purpose

Force any subsystem into mock mode regardless of configured credentials:

```bash
FORCE_MOCK_DB=true FORCE_MOCK_STRIPE=true FORCE_MOCK_EMAIL=true npm run dev
```

Then check `GET /api/health` to confirm all three report `"mock"`.

## Known trade-offs (read before production use)

- **`AUTH_SECRET`**: if unset, a hardcoded dev fallback is used so boot never
  fails — but this is insecure. `/api/health` surfaces a warning. **Always
  set `AUTH_SECRET` in production.**
- **Webhook idempotency under DB outage**: documented above — best-effort
  processing, not a hard guarantee, during a simultaneous DB+Stripe-webhook
  outage. This is an intentional trade-off favoring availability.
- **Scan data is currently 100% mock**: there's no live Amazon data source
  wired up yet. `run-scan.ts` has a clear seam (`runScan()`) where a real
  product-data API would slot in, with the same try/catch → mock-fallback
  shape as every other subsystem.
- **Next.js version**: pinned to `14.2.35` to include the December 2025 RSC
  security patches (CVE-2025-55183/55184/67779). Do not downgrade below this
  without checking current advisories.
- **Static-prerender trap on "no-input" GET routes**: any route handler with
  no `searchParams`/`cookies`/`headers` usage gets silently static-prerendered
  by Next.js at build time and serves a *frozen build-time snapshot forever*
  — this bit `/api/health` during development (it kept reporting build-time
  service status no matter how the environment changed afterward). Every
  GET route in this app that needs live data now explicitly declares
  `export const dynamic = "force-dynamic"` rather than relying on incidental
  dynamic-triggering usage. If you add a new GET route, add this line too.
- **Apify is manual-trigger only, no cron yet**: by design, to keep spend
  visible. If you later add a scheduled refresh (Vercel Cron, etc.), call
  the same `refreshTrendingHashtags()` / `refreshTiktokSearch()` functions
  used by the manual endpoint — don't duplicate the Apify-calling logic.
- **TikTok data sourcing is a documented gray area**: there is no first-party
  TikTok API for trending/hashtag discovery at the scale this product needs
  — Apify (and equivalent third-party scrapers) operate by extracting public
  page data, which is generally treated as legal in the US but sits in
  tension with TikTok's own Terms of Service. This is a known, deliberate
  trade-off, not an oversight; revisit if TikTok's official API surface
  changes.
