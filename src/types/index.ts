export type Tier = "free" | "pro";

export type Verdict = "BUY" | "SKIP" | "RISK";

export interface ScanRequest {
  asin?: string;
  productUrl?: string;
  cost?: number;
}

/** Base result (free + shared fields) */
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

  // optional pro preview fields
  netMargin?: number;
  roi?: number;
  fees?: number;
}

/** Pro-only expansion */
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
