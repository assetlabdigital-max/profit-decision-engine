/**
 * src/lib/retail/match-quality.ts
 *
 * Assesses how trustworthy a retail → Amazon product match is.
 * Store-exclusive brands and weak title overlap should not drive
 * arbitrage profit math.
 */

import type { RetailProduct } from "@/lib/retail/scraper";

/** Brands sold only (or primarily) at one retailer — unlikely to have a 1:1 Amazon listing. */
const STORE_EXCLUSIVE_BRANDS: Record<string, string[]> = {
  Target: [
    "all in motion",
    "good & gather",
    "good and gather",
    "up & up",
    "up and up",
    "cat & jack",
    "wild fable",
    "universal thread",
    "a new day",
    "shade & shore",
  ],
  Costco: ["kirkland signature", "kirkland"],
  Walmart: ["great value", "mainstays", "bettergoods", "equate"],
  "Sam's Club": ["member's mark", "members mark"],
};

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "in", "on", "of", "to", "by",
  "women", "womens", "men", "mens", "kids", "black", "white", "size", "pack",
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
  );
}

export function tokenOverlapScore(a: string, b: string): number {
  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }

  return shared / Math.max(tokensA.size, tokensB.size);
}

export function detectStoreExclusiveBrand(
  storeName: string,
  productName: string,
  scrapedBrand?: string
): { isExclusive: boolean; brandLabel: string | null } {
  const haystack = normalizeText([scrapedBrand, productName].filter(Boolean).join(" "));
  const brands = STORE_EXCLUSIVE_BRANDS[storeName] ?? [];

  for (const brand of brands) {
    if (haystack.includes(brand)) {
      return { isExclusive: true, brandLabel: brand };
    }
  }

  return { isExclusive: false, brandLabel: null };
}

export function amazonBrandAppearsInRetailTitle(amazonTitle: string, retailTitle: string): boolean {
  const amazonNorm = normalizeText(amazonTitle);
  const retailTokens = [...significantTokens(retailTitle)];

  // First token(s) of Amazon title are often the brand
  const amazonLead = amazonNorm.split(" ").slice(0, 3).join(" ");
  if (amazonLead.length > 3 && normalizeText(retailTitle).includes(amazonLead)) {
    return true;
  }

  const amazonBrandGuess = amazonNorm.split(" ")[0];
  return retailTokens.some((t) => t === amazonBrandGuess);
}

export interface RetailMatchQuality {
  confidence: "high" | "medium" | "low";
  overlapScore: number;
  isStoreExclusiveBrand: boolean;
  storeBrandLabel: string | null;
  profitAnalysisReliable: boolean;
  warnings: string[];
}

export function assessRetailMatchQuality(
  retail: RetailProduct,
  amazonTitle: string,
  baseConfidence: "high" | "medium" | "low"
): RetailMatchQuality {
  const warnings: string[] = [];
  const overlapScore = tokenOverlapScore(retail.productName, amazonTitle);
  const exclusive = detectStoreExclusiveBrand(retail.storeName, retail.productName, retail.brand);

  if (exclusive.isExclusive) {
    warnings.push(
      `"${exclusive.brandLabel}" is a ${retail.storeName} store brand — it usually has no identical Amazon listing. The matched ASIN is likely a similar product, not the same item.`
    );
  }

  if (!amazonBrandAppearsInRetailTitle(amazonTitle, retail.productName) && !exclusive.isExclusive) {
    warnings.push(
      "The Amazon listing brand/name does not closely match the store product — verify the ASIN manually before sourcing."
    );
  }

  if (overlapScore < 0.25) {
    warnings.push(
      "Low title similarity between store and Amazon listings — this match is unreliable for arbitrage."
    );
  }

  let confidence = baseConfidence;
  if (exclusive.isExclusive || overlapScore < 0.2) {
    confidence = "low";
  } else if (overlapScore < 0.4 && confidence === "high") {
    confidence = "medium";
  }

  const profitAnalysisReliable =
    !exclusive.isExclusive && overlapScore >= 0.35 && confidence !== "low";

  return {
    confidence,
    overlapScore,
    isStoreExclusiveBrand: exclusive.isExclusive,
    storeBrandLabel: exclusive.brandLabel,
    profitAnalysisReliable,
    warnings,
  };
}
