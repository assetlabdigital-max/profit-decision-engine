/**
 * src/app/api/tiktok/refresh/route.ts
 *
 * NODE RUNTIME. This is the ONLY user-facing trigger that causes an
 * Apify call. Protections, in order:
 *   1. Must be signed in (prevents anonymous credit-burning).
 *   2. Minimum cooldown between refreshes for the same target (prevents
 *      accidental double-click / spam burning Apify credits).
 *   3. Every failure mode (Apify down, DB down, malformed response)
 *      degrades to a clean JSON response — never a crash, and the
 *      existing cache is left untouched on failure.
 *
 * Usage:
 *   POST /api/tiktok/refresh { "type": "trending" }
 *   POST /api/tiktok/refresh { "type": "search", "query": "cooking", "queryType": "hashtag" }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth/auth";
import { refreshTrendingHashtags, refreshTiktokSearch } from "@/lib/tiktok/refresh";
import { getLastRefreshAttempt } from "@/lib/tiktok/cache";
import type { ApiResponse, RefreshResult } from "@/types";

// Minimum time between refreshes for the SAME target. This is the
// primary cost-control lever now that refresh is manual rather than a
// cron — without it, a few fast clicks could burn through Apify credits
// quickly. Tune here if needed.
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("trending"), industryCategory: z.string().optional() }),
  z.object({
    type: z.literal("search"),
    query: z.string().trim().min(1).max(64),
    queryType: z.enum(["hashtag", "keyword"]).default("hashtag"),
  }),
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log("🔥 TikTok refresh API START");

  try {
    const session = await auth().catch(() => null);
    const email = session?.user?.email;
    const userId = ((session?.user as any)?.id as string | undefined) ?? null;

    if (!email) {
      const body: ApiResponse<never> = {
        ok: false,
        error: "You must be signed in to refresh trend data.",
        code: "UNAUTHENTICATED",
      };
      return NextResponse.json(body, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      const body: ApiResponse<never> = { ok: false, error: "Invalid JSON body", code: "INVALID_INPUT" };
      return NextResponse.json(body, { status: 400 });
    }

    console.log("BODY =", payload);

    const parsed = bodySchema.safeParse(payload);
    if (!parsed.success) {
      const body: ApiResponse<never> = { ok: false, error: "Invalid request shape", code: "INVALID_INPUT" };
      return NextResponse.json(body, { status: 400 });
    }

    const input = parsed.data;
    console.log("PARSED =", input);

    const refreshType = input.type;
    const queryForCooldown = refreshType === "search" ? input.query : undefined;

    // Cooldown check — read-only, never blocks on failure (if the
    // cooldown check itself fails, we fail OPEN here since the downside
    // of occasionally allowing an extra refresh is just cost, not safety).
    const lastAttempt = await getLastRefreshAttempt(refreshType, queryForCooldown).catch(() => null);
    if (lastAttempt) {
      const elapsedMs = Date.now() - new Date(lastAttempt.at).getTime();
      if (elapsedMs < COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((COOLDOWN_MS - elapsedMs) / 1000);
        const body: ApiResponse<never> = {
          ok: false,
          error: `Refreshed recently — please wait ${retryAfterSec}s before trying again.`,
          code: "COOLDOWN_ACTIVE",
        };
        return NextResponse.json(body, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
      }
    }

    let result: RefreshResult;
    if (refreshType === "trending") {
      result = await refreshTrendingHashtags({ triggeredBy: userId, industryCategory: input.industryCategory });
    } else {
      result = await refreshTiktokSearch({
        query: input.query,
        queryType: input.queryType,
        triggeredBy: userId,
      });
    }

    console.log("🔥 FINAL API RESULT:", result);

    // Note: result.status === "mock_fallback" or "failed" still returns
    // HTTP 200 — the REQUEST succeeded (we handled it correctly); it's
    // the underlying Apify call that didn't produce fresh data. The
    // existing cache (mock or previously-real) continues to serve reads.
    const body: ApiResponse<RefreshResult> = {
      ok: true,
      data: result,
      mock: result.status !== "success",
    };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[REFRESH API ERROR]", err);
    const body: ApiResponse<never> = {
      ok: false,
      error: "Refresh temporarily unavailable. Please try again shortly.",
      code: "REFRESH_FALLBACK",
      mock: true,
    };
    return NextResponse.json(body, { status: 200 });
  }
}