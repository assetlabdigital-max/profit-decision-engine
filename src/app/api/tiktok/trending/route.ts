/**
 * src/app/api/tiktok/trending/route.ts
 *
 * NODE RUNTIME. Read-only. ALWAYS serves from the DB cache (or mock data
 * if the cache is empty/DB is down) — NEVER calls Apify directly. This
 * keeps the route fast and free regardless of how many users hit it.
 * To get fresh data, use POST /api/tiktok/refresh.
 */

export const runtime = "nodejs";
// Explicit even though searchParams usage already makes Next.js treat
// this as dynamic — declaring it directly avoids a silent regression to
// static-prerender if that usage is ever refactored away. See
// /api/health/route.ts for the incident that surfaced this class of bug.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCachedTrendingHashtags } from "@/lib/tiktok/cache";
import type { ApiResponse, TrendingHashtag } from "@/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam ?? "20", 10) || 20, 1), 50);

    const { items, meta } = await getCachedTrendingHashtags(limit);

    const body: ApiResponse<TrendingHashtag[]> = {
      ok: true,
      data: items,
      mock: meta.isMock,
    };
    return NextResponse.json(
      { ...body, lastRefreshedAt: meta.lastRefreshedAt },
      { status: 200 }
    );
  } catch (err) {
    // Last-resort safety net — should be unreachable since
    // getCachedTrendingHashtags never throws, but defense in depth.
    console.error("[api/tiktok/trending] unexpected error, returning empty mock fallback:", err);
    const body: ApiResponse<TrendingHashtag[]> = { ok: true, data: [], mock: true };
    return NextResponse.json(body, { status: 200 });
  }
}
