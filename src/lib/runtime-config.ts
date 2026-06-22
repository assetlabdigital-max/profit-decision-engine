/**
 * src/lib/runtime-config.ts
 *
 * SINGLE SOURCE OF TRUTH for "is this external service usable right now".
 *
 * Nothing else in the codebase should inspect process.env directly to decide
 * whether to call Stripe/DB/Resend. Everything reads from here so behavior
 * is consistent and testable, and so flipping FORCE_MOCK_* env vars
 * immediately and predictably puts a subsystem into mock mode.
 *
 * IMPORTANT: This file must be safe to import from BOTH Node and Edge
 * runtime code. It does not import pg, stripe, resend, or any Node-only
 * client — it only reads strings from process.env.
 */

function truthy(v: string | undefined): boolean {
  return v === "true" || v === "1" || v === "yes";
}

export interface RuntimeConfig {
  db: {
    enabled: boolean;
    url: string | undefined;
  };
  stripe: {
    enabled: boolean;
    secretKey: string | undefined;
    webhookSecret: string | undefined;
    priceIdMonthly: string | undefined;
    priceIdYearly: string | undefined;
  };
  email: {
    enabled: boolean;
    apiKey: string | undefined;
    from: string;
  };
  auth: {
    secret: string;
  };
  apify: {
    enabled: boolean;
    token: string | undefined;
    tiktokSearchActorId: string;
    tiktokTrendingActorId: string;
  };
  appUrl: string;
}

/**
 * Lazily computed, but cheap enough to recompute per-call.
 * We deliberately do NOT cache this at module load time so that
 * test suites / serverless cold starts always see current env state.
 */
export function getRuntimeConfig(): RuntimeConfig {
  const forceMockDb = truthy(process.env.FORCE_MOCK_DB);
  const forceMockStripe = truthy(process.env.FORCE_MOCK_STRIPE);
  const forceMockEmail = truthy(process.env.FORCE_MOCK_EMAIL);
  const forceMockApify = truthy(process.env.FORCE_MOCK_APIFY);

  const dbUrl = process.env.DATABASE_URL?.trim();
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const apifyToken = process.env.APIFY_API_TOKEN?.trim();

  return {
    db: {
      enabled: !forceMockDb && !!dbUrl,
      url: dbUrl,
    },
    stripe: {
      enabled: !forceMockStripe && !!stripeKey,
      secretKey: stripeKey,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim(),
      priceIdMonthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY?.trim(),
      priceIdYearly: process.env.STRIPE_PRICE_ID_PRO_YEARLY?.trim(),
    },
    email: {
      enabled: !forceMockEmail && !!resendKey,
      apiKey: resendKey,
      from: process.env.EMAIL_FROM?.trim() || "Profit Decision Engine <onboarding@resend.dev>",
    },
    auth: {
      // Never throw at import time if AUTH_SECRET is missing. Auth.js itself
      // will warn, but we provide a stable dev fallback so boot never fails.
      // In production you MUST set AUTH_SECRET — see /api/health for a warning surface.
      secret: process.env.AUTH_SECRET?.trim() || "dev-insecure-fallback-secret-do-not-use-in-prod",
    },
    apify: {
      enabled: !forceMockApify && !!apifyToken,
      token: apifyToken,
      // Actor IDs are env-overridable by design: Apify actors get
      // deprecated/renamed/replaced more often than DB schemas do, and
      // the actor that best fits "trending hashtags" vs "search by
      // keyword/hashtag" may change as you evaluate providers. Defaults
      // below point at commonly-used actors as of writing; verify on
      // apify.com before relying on them and override via env if needed.
      tiktokSearchActorId: process.env.APIFY_TIKTOK_SEARCH_ACTOR_ID?.trim() || "clockworks~tiktok-scraper",
      tiktokTrendingActorId:
        process.env.APIFY_TIKTOK_TRENDING_ACTOR_ID?.trim() || "scrapio~tiktok-trending-hashtags-scraper",
    },
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  };
}

/** Convenience flags for quick checks without destructuring. */
export function isDbEnabled(): boolean {
  return getRuntimeConfig().db.enabled;
}
export function isStripeEnabled(): boolean {
  return getRuntimeConfig().stripe.enabled;
}
export function isEmailEnabled(): boolean {
  return getRuntimeConfig().email.enabled;
}
export function isApifyEnabled(): boolean {
  return getRuntimeConfig().apify.enabled;
}
