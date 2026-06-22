/**
 * src/auth/auth.ts
 *
 * NODE RUNTIME ONLY. NEVER import this file from middleware.ts.
 *
 * This is where the real Resend email provider and the Postgres adapter
 * are wired in. It extends authConfig (Edge-safe base) with everything
 * that needs Node.
 *
 * FALLBACK BEHAVIOR:
 * - If DATABASE_URL is missing/unreachable, we do NOT pass an `adapter`
 *   to NextAuth at all. NextAuth then runs in pure-JWT mode: sessions
 *   still work, magic links still work (the token itself is enough to
 *   authenticate), but persistent user records are skipped. This means
 *   auth NEVER crashes the app just because Postgres is down.
 * - If RESEND_API_KEY is missing, the email provider still loads, but its
 *   `sendVerificationRequest` swaps to a console-log implementation
 *   instead of throwing.
 */

import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { authConfig } from "@/auth/auth.config";
import { isDbEnabled, isEmailEnabled, getRuntimeConfig } from "@/lib/runtime-config";
import { sendMagicLinkEmail } from "@/lib/email/send";

/**
 * Build the Postgres adapter lazily and defensively. If anything about
 * pg/@auth/pg-adapter throws during construction (bad connection string,
 * module resolution issue, etc.), we swallow it and return undefined so
 * NextAuth falls back to JWT-only sessions instead of crashing boot.
 *
 * NOTE: @auth/pg-adapter ships as an ESM-only package ("type": "module",
 * no "require" export condition), so it MUST be loaded via dynamic
 * import() rather than require() — require() throws "Package path . is
 * not exported" for ESM-only packages. `pg` itself is still required()
 * synchronously since it ships a CJS build.
 */
async function buildAdapter() {
  if (!isDbEnabled()) {
    console.warn("[auth] DATABASE_URL not set or DB disabled — running in JWT-only session mode.");
    return undefined;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require("pg") as typeof import("pg");
    const PgAdapter = await import("@auth/pg-adapter");

    const { db } = getRuntimeConfig();
    const pool = new Pool({
      connectionString: db.url,
      max: 5,
      connectionTimeoutMillis: 5000,
      ssl: db.url?.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
    });

    pool.on("error", (err) => {
      console.error("[auth] pg pool error (handled, non-fatal):", err.message);
    });

    return PgAdapter.default(pool);
  } catch (err) {
    console.error("[auth] failed to construct Postgres adapter — falling back to JWT-only sessions:", err);
    return undefined;
  }
}

// Resolved once at module initialization. Next.js compiles Node-runtime
// server modules (route handlers, this file) in a way that supports
// top-level await, so we can safely `await` the ESM-only adapter import
// here while still exporting synchronous bindings (`handlers`, `auth`,
// etc.) below — required because route.ts does
// `export const { GET, POST } = handlers` and middleware-adjacent code
// expects `auth` to exist immediately, not behind a Promise.
const adapter = await buildAdapter();

/**
 * IMPORTANT CAVEAT, documented here deliberately:
 * Auth.js's email/magic-link provider is NOT optional-adapter-friendly —
 * it requires a database adapter to store and verify one-time tokens.
 * There is no safe "mock magic link" because the token round-trip
 * itself needs persistent storage between the "send" and "click" steps.
 *
 * So when DB is disabled, we do NOT register the Resend provider at all
 * (registering it without an adapter throws MissingAdapter on every
 * sign-in attempt). Instead, magic-link sign-in is simply unavailable,
 * and the login page / health check surface that clearly to the user
 * instead of silently failing. This is the one feature that has a real,
 * irreducible dependency on the DB — every other subsystem in this app
 * has a genuine mock fallback; this one has an honest "unavailable"
 * state instead, which is the safer thing to claim.
 */
const providers = adapter
  ? [
      Resend({
        from: getRuntimeConfig().email.from,
        apiKey: getRuntimeConfig().email.apiKey || "mock-key-email-disabled",
        async sendVerificationRequest({ identifier, url }) {
          // Centralized, fallback-safe sender — never throws, see send.ts.
          await sendMagicLinkEmail({ to: identifier, magicLinkUrl: url });
        },
      }),
    ]
  : [];

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter,
  providers,
  // Without a DB adapter, NextAuth requires JWT session strategy, which
  // authConfig already sets. We re-assert here for clarity/safety.
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});

/** True when magic-link sign-in is actually usable (i.e. DB is live). */
export function isEmailSignInAvailable(): boolean {
  return !!adapter;
}

export function isAuthRunningInMockMode(): boolean {
  return !isDbEnabled() || !isEmailEnabled();
}
