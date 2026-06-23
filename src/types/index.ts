export type Tier = "free" | "pro";

export type Verdict = "BUY" | "SKIP" | "RISK";

export interface ScanRequest {
  asin?: string;
  productUrl?: string;
  cost?: number;
}

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
}

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
