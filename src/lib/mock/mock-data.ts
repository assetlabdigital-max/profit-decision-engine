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

function seededRandom(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MOCK_CATEGORIES = [
  "Home & Kitchen",
  "Toys & Games",
  "Sports & Outdoors",
  "Electronics",
  "Pet Supplies",
];

export function buildMockScanBase(asin: string): ScanResultBase {
  const rand = seededRandom(asin || "DEFAULT");
  const price = Math.round((10 + rand() * 60) * 100) / 100;
  const rating = Math.round((3 + rand() * 2) * 10) / 10;
  const reviewCount = Math.floor(50 + rand() * 5000);

  const verdicts: ScanResultBase["verdict"][] = ["BUY", "SKIP", "RISK"];
  const verdict = verdicts[Math.floor(rand() * verdicts.length)];

  const reasonMap: Record<string, string> = {
    BUY: "Strong demand signal in mock model.",
    SKIP: "Moderate opportunity in mock model.",
    RISK: "High volatility in mock model.",
  };

  return {
    asin: asin || "MOCKASIN",
    title: `Mock Product ${asin || "Sample"}`,
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

export function buildMockScanPro(
  asin: string,
  unitCost?: number
): ScanResultPro {
  const base = buildMockScanBase(asin);
  const rand = seededRandom(asin + "-pro");

  const cost = unitCost ?? base.price * 0.35;
  const referralFee = base.price * 0.15;
  const fbaFee = 3 + rand() * 4;
  const totalFees = referralFee + fbaFee;

  const netProfit = base.price - cost - totalFees;
  const marginPercent = (netProfit / base.price) * 100;
  const roiPercent = (netProfit / cost) * 100;

  const sellerCount = Math.floor(1 + rand() * 25);

  const competitionLevel: "low" | "medium" | "high" =
    sellerCount > 15 ? "high" : sellerCount > 5 ? "medium" : "low";

  return {
    ...base,

    estimatedFees: {
      referralFee,
      fbaFee,
      totalFees,
    },

    profit: {
      unitCost: cost,
      netProfit,
      marginPercent,
      roiPercent,
    },

    competition: {
      sellerCount,
      buyBoxPrice: base.price * (0.95 + rand() * 0.1),
      competitionLevel,
    },
  };
}

export function getMockTierForEmail(email?: string | null): Tier {
  if (email?.toLowerCase().includes("pro")) return "pro";
  return "free";
}
