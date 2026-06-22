/**
 * src/app/api/tiktok/search/route.ts
 *
 * NODE RUNTIME. Read-only. ALWAYS serves from the DB cache (or mock
 * data) for a given hashtag/keyword — NEVER calls Apify directly.
 * To populate/refresh the cache for a query, use POST /api/tiktok/refresh.
 *
 * Usage: GET /api/tiktok/search?q=cooking&type=hashtag
 */

export const runtime = "nodejs";
// Explicit even though searchParams usage already makes Next.js treat
// this as dynamic — declaring it directly avoids a silent regression to
// static-prerender if that usage is ever refactored away. See
// /api/health/route.ts for the incident that surfaced this class of bug.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCachedTiktokVideos } from "@/lib/tiktok/cache";
import type { ApiResponse, TiktokVideoResult, TiktokQueryType } from "@/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const query = req.nextUrl.searchParams.get("q")?.trim();
    const typeParam = req.nextUrl.searchParams.get("type");
    const queryType: TiktokQueryType = typeParam === "keyword" ? "keyword" : "hashtag";
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam ?? "20", 10) || 20, 1), 50);

    if (!query) {
      const body: ApiResponse<never> = {
        ok: false,
        error: "Query parameter 'q' is required",
        code: "MISSING_QUERY",
        mock: true,
      };
      return NextResponse.json(body, { status: 400 });
    }

    const { items, meta } = await getCachedTiktokVideos(query, queryType, limit);

    const body: ApiResponse<TiktokVideoResult[]> = {
      ok: true,
      data: items,
      mock: meta.isMock,
    };
    return NextResponse.json(
      { ...body, lastRefreshedAt: meta.lastRefreshedAt },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api/tiktok/search] unexpected error, returning empty mock fallback:", err);
    const body: ApiResponse<TiktokVideoResult[]> = { ok: true, data: [], mock: true };
    return NextResponse.json(body, { status: 200 });
  }
}
