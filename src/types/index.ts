export type Tier = "free" | "pro";

export type Verdict = "BUY" | "SKIP" | "RISK";

export interface ScanRequest {
  asin?: string;
  productUrl?: string;
  cost?: number;
}

/* ================= BASE ================= */

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
}

/* ================= PRO ================= */

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

/* ================= EXPORT ================= */

export type ScanResult = ScanResultBase | ScanResultPro;
