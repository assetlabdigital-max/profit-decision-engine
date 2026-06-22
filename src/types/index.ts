/**
 * src/types/index.ts
 * Shared domain types. Kept dependency-free so this file is safe to import
 * from Edge middleware, Node API routes, and client components alike.
 */

export type Tier = "free" | "pro";

export type Verdict = "BUY" | "SKIP" | "RISK";

export interface ScanRequest {
  asin?: string;
  productUrl?: string;
  cost?: number; // unit cost, used for Pro profit math
}

/** Fields every tier receives. */
export interface ScanResultBase {
  asin: string;
  title: string;
  verdict: Verdict;
  verdictReason: string;
  price: number;
  rating: number;
  reviewCount: number;
  category: string;
  isMock: boolean;
  generatedAt: string;
}

/** Extra fields Pro tier receives on top of the base fields. */
export interface ScanResultPro extends ScanResultBase {
  estimatedFees: {
    referralFee: number;
    fbaFee: number;
    totalFees: number;
  };
  profit: {
    unitCost: number;
    netProfit: number;
    marginPercent: number;
    roiPercent: number;
  };
  competition: {
    sellerCount: number;
    buyBoxPrice: number;
    competitionLevel: "low" | "medium" | "high";
  };
}

export type ScanResult = ScanResultBase | ScanResultPro;

export interface ApiErrorShape {
  ok: false;
  error: string;
  code: string;
  mock?: boolean;
}

export interface ApiOkShape<T> {
  ok: true;
  data: T;
  mock: boolean;
}

export type ApiResponse<T> = ApiOkShape<T> | ApiErrorShape;

export interface DbUser {
  id: string;
  email: string;
  tier: Tier;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  createdAt: string;
}

export interface ServiceHealth {
  db: "live" | "mock" | "error";
  stripe: "live" | "mock" | "error";
  email: "live" | "mock" | "error";
  apify: "live" | "mock" | "error";
}

// --- TikTok trend layer -----------------------------------------------

export interface TrendingHashtag {
  hashtag: string;
  rank: number | null;
  viewCount: number | null;
  videoCount: number | null;
  industryCategory: string | null;
  isMock: boolean;
  fetchedAt: string;
}

export type TiktokQueryType = "hashtag" | "keyword";

export interface TiktokVideoResult {
  videoId: string | null;
  authorUsername: string | null;
  caption: string | null;
  playCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  videoUrl: string | null;
  postedAt: string | null;
  isMock: boolean;
  fetchedAt: string;
}

export interface TiktokCacheMeta {
  /** True if every item returned is mock (cache was empty/stale-empty). */
  isMock: boolean;
  /** When the underlying cache was last successfully refreshed from Apify. */
  lastRefreshedAt: string | null;
}

export interface RefreshResult {
  status: "success" | "failed" | "mock_fallback";
  itemsFetched: number;
  errorMessage?: string;
}
