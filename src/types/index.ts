export type Tier = "free" | "pro";
export type Verdict = "BUY" | "SKIP" | "RISK";

/** REQUEST */
export interface ScanRequest {
  asin?: string;
  productUrl?: string;
  cost?: number;
}

/** BASE RESULT */
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

  netMargin?: number;
  roi?: number;
  fees?: number;

  competition?: "low" | "medium" | "high";
  eligibility?: "eligible" | "restricted" | "unknown";
  eligibilityReason?: string | null;
}

/** PRO RESULT (NOT EXTENDING BASE) */
export interface ScanResultPro {
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

  netMargin?: number;
  roi?: number;
  fees?: number;

  competition: {
    sellerCount: number;
    buyBoxPrice: number;
    competitionLevel: "low" | "medium" | "high";
  };
  
  eligibility?: "eligible" | "restricted" | "unknown";
  eligibilityReason?: string | null;

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
}

/** UNION */
export type ScanResult = ScanResultBase | ScanResultPro;

/** API */
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
  /** Set when a retail URL scan fell back to demo data (scrape or Amazon match failed). */
  mockReason?: "retail_scrape_failed" | "amazon_match_failed";
}

export type ApiResponse<T> = ApiOkShape<T> | ApiErrorShape;

/** DB */
export interface DbUser {
  id: string;
  email: string;
  tier: Tier;

  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;

  createdAt: string;
}

/** HEALTH */
export interface ServiceHealth {
  db: "live" | "mock" | "error";
  stripe: "live" | "mock" | "error";
  email: "live" | "mock" | "error";
  apify: "live" | "mock" | "error";
}

/** TIKTOK */
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
  isMock: boolean;
  lastRefreshedAt: string | null;
}

export interface RefreshResult {
  status: "success" | "failed" | "mock_fallback";
  itemsFetched: number;
  errorMessage?: string;
}
