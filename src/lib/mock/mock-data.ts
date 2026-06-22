/**
 * src/lib/mock/mock-data.ts
 *
 * Deterministic, dependency-free mock data. Safe to import from Edge or
 * Node. This is what the rest of the app falls back to when DB/Stripe/
 * Resend are unavailable, so the user always gets a coherent response
 * instead of an error.
 */

import type { DbUser, ScanResultBase, ScanResultPro, Tier } from "@/types";

export function getMockUser(email: string): DbUser {
  return {
    id: `mock-${hashString(email)}`,
    email,
    tier: "free",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    createdAt: new Date(0).toISOString(),
  };
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

/** Pseudo-random but deterministic per-ASIN, so demos look stable. */
function seededRandom(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MOCK_CATEGORIES = ["Home & Kitchen", "Toys & Games", "Sports & Outdoors", "Electronics", "Pet Supplies"];

export function buildMockScanBase(asin: string): ScanResultBase {
  const rand = seededRandom(asin || "DEFAULT_ASIN");
  const price = Math.round((10 + rand() * 60) * 100) / 100;
  const rating = Math.round((3 + rand() * 2) * 10) / 10;
  const reviewCount = Math.floor(50 + rand() * 5000);

  const verdicts: Array<ScanResultBase["verdict"]> = ["BUY", "SKIP", "RISK"];
  const verdict = verdicts[Math.floor(rand() * verdicts.length)];
  const reasonMap: Record<string, string> = {
    BUY: "Strong demand signal and healthy margin headroom in mock model.",
    SKIP: "Margin too thin or saturation too high in mock model.",
    RISK: "Volatile rating/review trend in mock model — needs manual review.",
  };

  return {
    asin: asin || "MOCKASIN001",
    title: `Mock Product ${asin || "Sample"} — Demo Listing`,
    verdict,
    verdictReason: reasonMap[verdict],
    price,
    rating,
    reviewCount,
    category: MOCK_CATEGORIES[Math.floor(rand() * MOCK_CATEGORIES.length)],
    isMock: true,
    generatedAt: new Date().toISOString(),
  };
}

export function buildMockScanPro(asin: string, unitCost?: number): ScanResultPro {
  const base = buildMockScanBase(asin);
  const rand = seededRandom(asin + "-pro");

  const cost = unitCost ?? Math.round(base.price * 0.35 * 100) / 100;
  const referralFee = Math.round(base.price * 0.15 * 100) / 100;
  const fbaFee = Math.round((3 + rand() * 4) * 100) / 100;
  const totalFees = Math.round((referralFee + fbaFee) * 100) / 100;
  const netProfit = Math.round((base.price - cost - totalFees) * 100) / 100;
  const marginPercent = base.price > 0 ? Math.round((netProfit / base.price) * 1000) / 10 : 0;
  const roiPercent = cost > 0 ? Math.round((netProfit / cost) * 1000) / 10 : 0;

  const sellerCount = Math.floor(1 + rand() * 25);
  const competitionLevel: ScanResultPro["competition"]["competitionLevel"] =
    sellerCount > 15 ? "high" : sellerCount > 5 ? "medium" : "low";

  return {
    ...base,
    estimatedFees: { referralFee, fbaFee, totalFees },
    profit: { unitCost: cost, netProfit, marginPercent, roiPercent },
    competition: {
      sellerCount,
      buyBoxPrice: Math.round((base.price * (0.95 + rand() * 0.1)) * 100) / 100,
      competitionLevel,
    },
  };
}

export function getMockTierForEmail(email: string | null | undefined): Tier {
  // Demo convenience: emails containing "pro" preview the Pro experience
  // without needing live Stripe — handy for screenshots/QA.
  if (email?.toLowerCase().includes("pro")) return "pro";
  return "free";
}
