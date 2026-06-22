/**
 * src/lib/tiktok/mock-data.ts
 *
 * Deterministic, dependency-free mock data for the TikTok trend layer.
 * Safe to import from Edge or Node. Used whenever the DB cache is empty
 * AND Apify hasn't been triggered yet — this is what a brand-new
 * install sees before anyone clicks "refresh" for the first time.
 */

import type { TrendingHashtag, TiktokVideoResult, TiktokQueryType } from "@/types";

function seededRandom(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MOCK_TRENDING_HASHTAGS = [
  "fyp",
  "amazonfinds",
  "tiktokmademebuyit",
  "smallbusiness",
  "producthacks",
  "homedecor",
  "kitchengadgets",
  "petproducts",
  "fitnessgear",
  "giftideas",
];

const MOCK_CATEGORIES = [
  "Home Improvement",
  "Apparel Accessories",
  "Beauty Personal Care",
  "Pets",
  "Sports Outdoor",
  "Household Products",
];

export function buildMockTrendingHashtags(count = 10): TrendingHashtag[] {
  const now = new Date().toISOString();
  const rand = seededRandom("trending-snapshot");

  return MOCK_TRENDING_HASHTAGS.slice(0, count).map((hashtag, idx) => ({
    hashtag,
    rank: idx + 1,
    viewCount: Math.floor((5 + rand() * 500) * 1_000_000),
    videoCount: Math.floor(1000 + rand() * 200_000),
    industryCategory: MOCK_CATEGORIES[Math.floor(rand() * MOCK_CATEGORIES.length)],
    isMock: true,
    fetchedAt: now,
  }));
}

export function buildMockTiktokVideos(query: string, queryType: TiktokQueryType, count = 12): TiktokVideoResult[] {
  const now = new Date().toISOString();
  const rand = seededRandom(`${queryType}:${query}`);

  return Array.from({ length: count }, (_, i) => {
    const playCount = Math.floor((10 + rand() * 5000) * 1000);
    const likeCount = Math.floor(playCount * (0.05 + rand() * 0.15));
    return {
      videoId: `mock-${query.replace(/\s+/g, "-")}-${i}`,
      authorUsername: `creator_${Math.floor(rand() * 99999)}`,
      caption: `Mock result for ${queryType === "hashtag" ? "#" : ""}${query} — demo content ${i + 1}`,
      playCount,
      likeCount,
      commentCount: Math.floor(likeCount * (0.02 + rand() * 0.05)),
      shareCount: Math.floor(likeCount * (0.01 + rand() * 0.03)),
      videoUrl: `https://www.tiktok.com/@mock/video/000000000000${i}`,
      postedAt: new Date(Date.now() - Math.floor(rand() * 14) * 86_400_000).toISOString(),
      isMock: true,
      fetchedAt: now,
    };
  });
}
