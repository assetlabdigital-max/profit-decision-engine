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

// ===============================
// TRENDING REFRESH
// ===============================

export async function refreshTrendingHashtags(params: {
  triggeredBy: string | null;
  industryCategory?: string;
  limit?: number;
}): Promise<RefreshResult> {
  console.log("[REFRESH START trending]");

  const { apify } = getRuntimeConfig();
  const limit = params.limit ?? 20;

  console.log("[APIFY CONFIG trending]", {
    enabled: apify.enabled,
    actorId: apify.tiktokTrendingActorId,
  });

  const run = await runApifyActor(apify.tiktokTrendingActorId, {
    maxItems: limit,
    ...(params.industryCategory ? { industryCategory: params.industryCategory } : {}),
  });

  console.log("[APIFY RAW RESULT trending]", run);

  if (!run.ok) {
    console.error("❌ APIFY FAILED trending:", { error: run.error, enabled: apify.enabled });
  }

  let result: RefreshResult;

  if (!run.ok) {
    result = { status: "mock_fallback", itemsFetched: 0, errorMessage: run.error };
  } else {
    try {
      console.log("[NORMALIZE START trending] count =", run.items?.length);
      const normalized = run.items.map((item, idx) => normalizeTrendingHashtagItem(item, idx + 1));
      console.log("[NORMALIZED trending]", normalized.length);

      const writeResult = await replaceTrendingHashtagsCache(normalized);

      if (!writeResult.ok) {
        console.error("❌ DB INSERT FAILED trending:", writeResult);
      }

      result = writeResult.ok
        ? { status: "success", itemsFetched: normalized.length }
        : { status: "failed", itemsFetched: 0, errorMessage: "Cache write failed" };
    } catch (err) {
      console.error("❌ NORMALIZATION ERROR trending:", err);
      result = {
        status: "failed",
        itemsFetched: 0,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  await logRefreshAttempt({ refreshType: "trending", triggeredBy: params.triggeredBy, result });

  console.log("🔥 FINAL RESULT trending:", JSON.stringify(result, null, 2));

  return result;
}

// ===============================
// SEARCH REFRESH
// ===============================

export async function refreshTiktokSearch(params: {
  query: string;
  queryType: TiktokQueryType;
  triggeredBy: string | null;
  limit?: number;
}): Promise<RefreshResult> {
  console.log("[REFRESH START search]", params);

  const { apify } = getRuntimeConfig();
  const limit = params.limit ?? 20;

  const input =
    params.queryType === "hashtag"
      ? { hashtags: [params.query.replace(/^#/, "")], resultsPerPage: limit }
      : { searchQueries: [params.query], resultsPerPage: limit };

  console.log("[APIFY INPUT search]", input);

  const run = await runApifyActor(apify.tiktokSearchActorId, input);

  console.log("[APIFY RAW RESULT search]", run);

  if (!run.ok) {
    console.error("❌ APIFY FAILED search:", run.error);
  }

  let result: RefreshResult;

  if (!run.ok) {
    result = { status: "mock_fallback", itemsFetched: 0, errorMessage: run.error };
  } else {
    try {
      console.log("[NORMALIZE START search] count =", run.items?.length);
      const normalized = run.items.map((item) => normalizeTiktokVideoItem(item));
      console.log("[NORMALIZED search]", normalized.length);

      const writeResult = await replaceTiktokVideosCache(params.query, params.queryType, normalized);

      if (!writeResult.ok) {
        console.error("❌ DB INSERT FAILED search:", writeResult);
      }

      result = writeResult.ok
        ? { status: "success", itemsFetched: normalized.length }
        : { status: "failed", itemsFetched: 0, errorMessage: "Cache write failed" };
    } catch (err) {
      console.error("❌ NORMALIZATION ERROR search:", err);
      result = {
        status: "failed",
        itemsFetched: 0,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  await logRefreshAttempt({
    refreshType: "search",
    query: params.query,
    triggeredBy: params.triggeredBy,
    result,
  });

  console.log("🔥 FINAL RESULT search:", JSON.stringify(result, null, 2));

  return result;
}
