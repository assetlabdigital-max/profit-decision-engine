/**
 * src/lib/tiktok/cache.ts
 *
 * NODE RUNTIME ONLY (imports safeQuery, which imports pg).
 *
 * This is the ONLY place that reads/writes the TikTok cache tables.
 * Read functions ALWAYS return something usable: real cached rows if
 * present, otherwise deterministic mock data — never an error, never an
 * empty array that the caller has to special-case.
 *
 * This file must export exactly these 6 functions for the pipeline to
 * compile:
 *   - getCachedTrendingHashtags    (used by GET /api/tiktok/trending)
 *   - replaceTrendingHashtagsCache (used by refresh.ts)
 *   - getCachedTiktokVideos        (used by GET /api/tiktok/search)
 *   - replaceTiktokVideosCache     (used by refresh.ts)
 *   - logRefreshAttempt            (used by refresh.ts)
 *   - getLastRefreshAttempt        (used by route.ts for cooldown check)
 */

import { safeQuery } from "@/lib/db/safe-query";
import type { TrendingHashtag, TiktokVideoResult, TiktokQueryType, TiktokCacheMeta, RefreshResult } from "@/types";
import { buildMockTrendingHashtags, buildMockTiktokVideos } from "@/lib/tiktok/mock-data";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^#/, "");
}

// --- Trending hashtags ---------------------------------------------------

export async function getCachedTrendingHashtags(
  limit = 20
): Promise<{ items: TrendingHashtag[]; meta: TiktokCacheMeta }> {
  const result = await safeQuery<any>(
    `select hashtag, rank, view_count, video_count, industry_category, is_mock, fetched_at
     from tiktok_trending_hashtags
     where fetched_at = (select max(fetched_at) from tiktok_trending_hashtags)
     order by rank asc nulls last
     limit $1`,
    [limit]
  );

  if (result.ok && result.rows.length > 0) {
    const items: TrendingHashtag[] = result.rows.map((r) => ({
      hashtag: r.hashtag,
      rank: r.rank,
      viewCount: r.view_count !== null ? Number(r.view_count) : null,
      videoCount: r.video_count !== null ? Number(r.video_count) : null,
      industryCategory: r.industry_category,
      isMock: r.is_mock,
      fetchedAt: r.fetched_at instanceof Date ? r.fetched_at.toISOString() : r.fetched_at,
    }));
    return {
      items,
      meta: { isMock: items.every((i) => i.isMock), lastRefreshedAt: items[0]?.fetchedAt ?? null },
    };
  }

  // Cache empty or DB unavailable — serve mock, but be honest about it.
  return {
    items: buildMockTrendingHashtags(limit),
    meta: { isMock: true, lastRefreshedAt: null },
  };
}

export async function replaceTrendingHashtagsCache(
  hashtags: Omit<TrendingHashtag, "fetchedAt">[]
): Promise<{ ok: boolean }> {
  if (hashtags.length === 0) return { ok: true };

  const fetchedAt = new Date();
  const values: unknown[] = [];
  const placeholders = hashtags
    .map((h, i) => {
      const base = i * 6;
      values.push(h.hashtag, h.rank, h.viewCount, h.videoCount, h.industryCategory, h.isMock);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${
        hashtags.length * 6 + 1
      })`;
    })
    .join(", ");

  values.push(fetchedAt);

  const result = await safeQuery(
    `insert into tiktok_trending_hashtags
       (hashtag, rank, view_count, video_count, industry_category, is_mock, fetched_at)
     values ${placeholders}`,
    values
  );

  return { ok: result.ok };
}

// --- Hashtag / keyword video search --------------------------------------

export async function getCachedTiktokVideos(
  query: string,
  queryType: TiktokQueryType,
  limit = 20
): Promise<{ items: TiktokVideoResult[]; meta: TiktokCacheMeta }> {
  const normalized = normalizeQuery(query);

  const result = await safeQuery<any>(
    `select video_id, author_username, caption, play_count, like_count,
            comment_count, share_count, video_url, posted_at, is_mock, fetched_at
     from tiktok_hashtag_videos
     where query = $1 and query_type = $2
       and fetched_at = (
         select max(fetched_at) from tiktok_hashtag_videos
         where query = $1 and query_type = $2
       )
     order by play_count desc nulls last
     limit $3`,
    [normalized, queryType, limit]
  );

  if (result.ok && result.rows.length > 0) {
    const items: TiktokVideoResult[] = result.rows.map((r) => ({
      videoId: r.video_id,
      authorUsername: r.author_username,
      caption: r.caption,
      playCount: r.play_count !== null ? Number(r.play_count) : null,
      likeCount: r.like_count !== null ? Number(r.like_count) : null,
      commentCount: r.comment_count !== null ? Number(r.comment_count) : null,
      shareCount: r.share_count !== null ? Number(r.share_count) : null,
      videoUrl: r.video_url,
      postedAt: r.posted_at instanceof Date ? r.posted_at.toISOString() : r.posted_at,
      isMock: r.is_mock,
      fetchedAt: r.fetched_at instanceof Date ? r.fetched_at.toISOString() : r.fetched_at,
    }));
    return {
      items,
      meta: { isMock: items.every((i) => i.isMock), lastRefreshedAt: items[0]?.fetchedAt ?? null },
    };
  }

  return {
    items: buildMockTiktokVideos(normalized, queryType, limit),
    meta: { isMock: true, lastRefreshedAt: null },
  };
}

export async function replaceTiktokVideosCache(
  query: string,
  queryType: TiktokQueryType,
  videos: Omit<TiktokVideoResult, "fetchedAt">[]
): Promise<{ ok: boolean }> {
  if (videos.length === 0) return { ok: true };

  const normalized = normalizeQuery(query);
  const fetchedAt = new Date();
  const values: unknown[] = [];
  const placeholders = videos
    .map((v, i) => {
      const base = i * 11;
      values.push(
        normalized,
        queryType,
        v.videoId,
        v.authorUsername,
        v.caption,
        v.playCount,
        v.likeCount,
        v.commentCount,
        v.shareCount,
        v.videoUrl,
        v.postedAt
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${
        base + 8
      }, $${base + 9}, $${base + 10}, $${base + 11}, $${videos.length * 11 + 1}, $${videos.length * 11 + 2})`;
    })
    .join(", ");

  values.push(videos[0]?.isMock ?? false, fetchedAt);

  const result = await safeQuery(
    `insert into tiktok_hashtag_videos
       (query, query_type, video_id, author_username, caption, play_count,
        like_count, comment_count, share_count, video_url, posted_at, is_mock, fetched_at)
     values ${placeholders}`,
    values
  );

  return { ok: result.ok };
}

// --- Refresh log (rate-limit / "last refreshed" UI) ----------------------

export async function logRefreshAttempt(params: {
  refreshType: "trending" | "search";
  query?: string;
  triggeredBy: string | null;
  result: RefreshResult;
}): Promise<void> {
  const { ok } = await safeQuery(
    `insert into tiktok_refresh_log (refresh_type, query, triggered_by, status, items_fetched, error_message)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      params.refreshType,
      params.query ?? null,
      params.triggeredBy,
      params.result.status,
      params.result.itemsFetched,
      params.result.errorMessage ?? null,
    ]
  );
  if (!ok) {
    console.warn("[tiktok/cache] failed to write refresh log (non-fatal, ignored)");
  }
}

/** Returns the timestamp of the most recent refresh attempt, or null. */
export async function getLastRefreshAttempt(
  refreshType: "trending" | "search",
  query?: string
): Promise<{ at: string; status: string } | null> {
  const result = await safeQuery<any>(
    query
      ? `select created_at, status from tiktok_refresh_log
         where refresh_type = $1 and query = $2
         order by created_at desc limit 1`
      : `select created_at, status from tiktok_refresh_log
         where refresh_type = $1
         order by created_at desc limit 1`,
    query ? [refreshType, normalizeQuery(query)] : [refreshType]
  );

  if (result.ok && result.rows[0]) {
    const row = result.rows[0];
    return {
      at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      status: row.status,
    };
  }
  return null;
}
