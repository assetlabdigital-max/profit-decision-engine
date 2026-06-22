/**
 * src/app/api/health/route.ts
 *
 * NODE RUNTIME. Surfaces which subsystems are running live vs mock.
 * Always returns 200 — a degraded subsystem is reported in the body,
 * not as an HTTP error, since "DB is down" should not make load
 * balancers think the whole app is unhealthy when it's still serving
 * mock responses correctly.
 */

export const runtime = "nodejs";
// CRITICAL: without this, Next.js detects no dynamic inputs (no
// searchParams, no cookies, etc.) in this route and prerenders it ONCE
// at build time, then serves that frozen snapshot for the life of the
// deployment — meaning a health check would never reflect real DB/Stripe/
// Apify status changes after boot. Discovered via a build-time
// `.next/server/app/api/health.body` artifact that kept being served
// instead of a fresh response. Every status/diagnostic route in this
// app needs this for the same reason.
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isDbReachable } from "@/lib/db/safe-query";
import { isStripeEnabled, isEmailEnabled, isApifyEnabled, getRuntimeConfig } from "@/lib/runtime-config";
import { isEmailSignInAvailable } from "@/auth/auth";
import type { ServiceHealth } from "@/types";

export async function GET(): Promise<NextResponse> {
  const health: ServiceHealth = {
    db: "mock",
    stripe: "mock",
    email: "mock",
    apify: "mock",
  };

  try {
    const dbLive = await isDbReachable();
    health.db = dbLive ? "live" : "mock";
  } catch (err) {
    console.error("[health] db check threw unexpectedly:", err);
    health.db = "error";
  }

  health.stripe = isStripeEnabled() ? "live" : "mock";
  health.email = isEmailEnabled() ? "live" : "mock";
  health.apify = isApifyEnabled() ? "live" : "mock";

  const { auth } = getRuntimeConfig();
  const warnings: string[] = [];
  if (auth.secret.startsWith("dev-insecure-fallback")) {
    warnings.push("AUTH_SECRET is not set — using an insecure dev fallback. Set AUTH_SECRET in production.");
  }
  if (!isEmailSignInAvailable()) {
    warnings.push(
      "Magic-link sign-in is unavailable: it requires a live database adapter (DATABASE_URL not set or DB unreachable)."
    );
  }
  if (!isApifyEnabled()) {
    warnings.push("Apify is not configured — TikTok trending/search endpoints will serve mock data only.");
  }

  return NextResponse.json(
    {
      ok: true,
      status: "up",
      services: health,
      emailSignInAvailable: isEmailSignInAvailable(),
      warnings,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
