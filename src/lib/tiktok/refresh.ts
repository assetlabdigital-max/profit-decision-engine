/**
 * src/lib/tiktok/refresh.ts
 *
 * NODE RUNTIME. This is the ONLY code path that calls Apify. It is
 * invoked exclusively by the manual-trigger refresh endpoint
 * (POST /api/tiktok/refresh) — never by a GET/read route.
 *
 * Flow: call Apify -> normalize results -> write to cache table ->
 * log the attempt. Every step is fallback-safe: if Apify fails, we log
 * `mock_fallback` and leave the existing cache untouched (we do NOT
 * wipe good cached data just because a refresh attempt failed).
 */

import { runApifyActor } from "@/lib/apify/client";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { normalizeTrendingHashtagItem, normalizeTiktokVideoItem } from "@/lib/tiktok/normalize";
import { replaceTrendingHashtagsCache, replaceTiktokVideosCache, logRefreshAttempt } from "@/lib/tiktok/cache";
import type { RefreshResult, TiktokQueryType } from "@/types";

export async function refreshTrendingHashtags(params: {
  triggeredBy: string | null;
  industryCategory?: string;
  limit?: number;
}): Promise<RefreshResult> {
  const { apify } = getRuntimeConfig();
  const limit = params.limit ?? 20;

  const run = await runApifyActor(apify.tiktokTrendingActorId, {
    maxItems: limit,
    ...(params.industryCategory ? { industryCategory: params.industryCategory } : {}),
  });

  let result: RefreshResult;

  if (!run.ok) {
    result = { status: "mock_fallback", itemsFetched: 0, errorMessage: run.error };
  } else {
    try {
      const normalized = run.items.map((item, idx) => normalizeTrendingHashtagItem(item, idx + 1));
      const writeResult = await replaceTrendingHashtagsCache(normalized);
      result = writeResult.ok
        ? { status: "success", itemsFetched: normalized.length }
        : { status: "failed", itemsFetched: 0, errorMessage: "Cache write failed" };
    } catch (err) {
      console.error("[tiktok/refresh] failed to normalize/cache trending hashtags:", err);
      result = {
        status: "failed",
        itemsFetched: 0,
        errorMessage: err instanceof Error ? err.message : "Unknown normalization error",
      };
    }
  }

  await logRefreshAttempt({ refreshType: "trending", triggeredBy: params.triggeredBy, result });
  return result;
}

export async function refreshTiktokSearch(params: {
  query: string;
  queryType: TiktokQueryType;
  triggeredBy: string | null;
  limit?: number;
}): Promise<RefreshResult> {
  const { apify } = getRuntimeConfig();
  const limit = params.limit ?? 20;

  const input =
    params.queryType === "hashtag"
      ? { hashtags: [params.query.replace(/^#/, "")], resultsPerPage: limit }
      : { searchQueries: [params.query], resultsPerPage: limit };

  const run = await runApifyActor(apify.tiktokSearchActorId, input);

  let result: RefreshResult;

  if (!run.ok) {
    result = { status: "mock_fallback", itemsFetched: 0, errorMessage: run.error };
  } else {
    try {
      const normalized = run.items.map((item) => normalizeTiktokVideoItem(item));
      const writeResult = await replaceTiktokVideosCache(params.query, params.queryType, normalized);
      result = writeResult.ok
        ? { status: "success", itemsFetched: normalized.length }
        : { status: "failed", itemsFetched: 0, errorMessage: "Cache write failed" };
    } catch (err) {
      console.error("[tiktok/refresh] failed to normalize/cache search results:", err);
      result = {
        status: "failed",
        itemsFetched: 0,
        errorMessage: err instanceof Error ? err.message : "Unknown normalization error",
      };
    }
  }

  await logRefreshAttempt({
    refreshType: "search",
    query: params.query,
    triggeredBy: params.triggeredBy,
    result,
  });
  return result;
}
