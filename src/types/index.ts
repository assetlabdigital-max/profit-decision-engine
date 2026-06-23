export type Tier = "free" | "pro";

export type Verdict = "BUY" | "SKIP" | "RISK";

export interface ScanRequest {
  asin?: string;
  productUrl?: string;
  cost?: number;
}

/** Base는 최소 공통만 */
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

  // ⚠️ PRO 전용은 base에서는 primitive or optional로만
  netMargin?: number;
  roi?: number;
  fees?: number;

  competition?: "low" | "medium" | "high";
}

/** PRO는 Base를 extend하지 않는다 (핵심 수정) */
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

  netMargin: number;
  roi: number;
  fees: number;

  competition: {
    sellerCount: number;
    buyBoxPrice: number;
    competitionLevel: "low" | "medium" | "high";
  };
}

export type ScanResult = ScanResultBase | ScanResultPro;
