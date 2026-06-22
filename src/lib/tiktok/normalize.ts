/**
 * src/lib/tiktok/normalize.ts
 *
 * NODE RUNTIME. Apify actor output fields are NOT a stable, guaranteed
 * contract — different actors (and different versions of the same
 * actor) use slightly different field names. This module is the single
 * place that defensively reads from raw Apify JSON, so a field-name
 * drift breaks one file instead of being scattered through the
 * codebase. Every field access is optional-chained; a missing field
 * becomes `null`, never a thrown error.
 */

import type { TrendingHashtag, TiktokVideoResult } from "@/types";

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && !Number.isNaN(n) ? n : null;
}

function toStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Normalizes one raw item from a "trending hashtags" Apify actor.
 * Field names vary across actors (e.g. `hashtagName` vs `name` vs
 * `title`), so we check several common shapes.
 */
export function normalizeTrendingHashtagItem(raw: any, fallbackRank: number): Omit<TrendingHashtag, "fetchedAt"> {
  const hashtag =
    toStringOrNull(raw?.hashtagName) ??
    toStringOrNull(raw?.name) ??
    toStringOrNull(raw?.title) ??
    toStringOrNull(raw?.hashtag) ??
    "unknown";

  return {
    hashtag: hashtag.replace(/^#/, ""),
    rank: toNumberOrNull(raw?.rank) ?? fallbackRank,
    viewCount: toNumberOrNull(raw?.viewCount ?? raw?.views ?? raw?.publishCnt),
    videoCount: toNumberOrNull(raw?.videoCount ?? raw?.videoCnt ?? raw?.postCount),
    industryCategory: toStringOrNull(raw?.industryCategory ?? raw?.category ?? raw?.industry),
    isMock: false,
  };
}

/**
 * Normalizes one raw video item from a TikTok search/hashtag Apify actor
 * (e.g. clockworks/tiktok-scraper output shape). Handles both flat and
 * nested (authorMeta.*, videoMeta.*, stats.*) field conventions seen
 * across different actor versions.
 */
export function normalizeTiktokVideoItem(raw: any): Omit<TiktokVideoResult, "fetchedAt"> {
  const stats = raw?.stats ?? raw;
  const author = raw?.authorMeta ?? raw?.author ?? {};

  return {
    videoId: toStringOrNull(raw?.id ?? raw?.videoId ?? raw?.itemId),
    authorUsername: toStringOrNull(author?.name ?? author?.uniqueId ?? author?.username),
    caption: toStringOrNull(raw?.text ?? raw?.caption ?? raw?.desc),
    playCount: toNumberOrNull(stats?.playCount ?? raw?.playCount ?? raw?.views),
    likeCount: toNumberOrNull(stats?.diggCount ?? raw?.diggCount ?? raw?.likes ?? raw?.heartCount),
    commentCount: toNumberOrNull(stats?.commentCount ?? raw?.commentCount ?? raw?.comments),
    shareCount: toNumberOrNull(stats?.shareCount ?? raw?.shareCount ?? raw?.shares),
    videoUrl: toStringOrNull(raw?.webVideoUrl ?? raw?.videoUrl ?? raw?.url),
    postedAt:
      toStringOrNull(raw?.createTimeISO) ??
      (toNumberOrNull(raw?.createTime) ? new Date(toNumberOrNull(raw?.createTime)! * 1000).toISOString() : null),
    isMock: false,
  };
}
