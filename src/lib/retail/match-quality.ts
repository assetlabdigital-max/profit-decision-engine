/**
 * src/lib/retail/match-quality.ts
 *
 * Assesses how trustworthy a retail → Amazon product match is.
 */

import type { RetailProduct } from "@/lib/retail/types";
import {
  normalizeText,
  extractPackCount,
  significantTokens,
} from "@/lib/retail/title-parse";
import {
  assessRetailEdgeCases,
  edgeCasesToWarnings,
  edgeCaseMatchPenalty,
  detectPriceEdgeCases,
  type RetailEdgeCaseCode,
} from "@/lib/retail/edge-cases";

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "in", "on", "of", "to", "by",
  "women", "womens", "men", "mens", "kids", "black", "white", "size",
]);

/** Generic product-line words — not useful for variant matching. */
const PRODUCT_LINE_WORDS = new Set([
  "new", "free", "set", "pack", "count", "ct", "fluid", "ounce", "ounces",
  "body", "lotion", "moisture", "moisturizing", "moisturizer", "cream", "wash",
  "shampoo", "conditioner", "spray", "serum", "gel", "oil", "soap", "candle",
  "chair", "desk", "table", "shirt", "pants", "jogger", "joggers", "cargo",
  "active", "light", "mid", "rise", "better", "shea", "hour", "24h", "24",
  "fl", "oz", "inch", "inches", "large", "medium", "small", "extra", "one",
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "ultra", "super", "premium", "original", "classic", "daily", "night",
  "day", "unisex", "adult", "kids", "baby", "refill", "bonus", "value",
]);

export interface VariantMismatchResult {
  mismatched: boolean;
  reasons: string[];
  retailPackCount: number;
  amazonPackCount: number;
  retailDistinctive: string[];
  amazonDistinctive: string[];
}

export { extractPackCount } from "@/lib/retail/title-parse";

export function tokenOverlapScore(a: string, b: string): number {
  const tokensA = significantTokens(a, STOP_WORDS);
  const tokensB = significantTokens(b, STOP_WORDS);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }

  return shared / Math.max(tokensA.size, tokensB.size);
}

/** Tokens that distinguish scent/color/style — present in one title but not the other. */
function distinctiveVariantTokens(title: string, otherTitle: string): string[] {
  const tokens = significantTokens(title, STOP_WORDS);
  const other = significantTokens(otherTitle, STOP_WORDS);
  const distinctive: string[] = [];

  for (const token of tokens) {
    if (other.has(token)) continue;
    if (PRODUCT_LINE_WORDS.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    distinctive.push(token);
  }

  return distinctive;
}

/**
 * Detect scent/color/pack mismatches (e.g. Beach Waves vs Vanilla Cashmere 2-Pack).
 */
export function detectVariantMismatch(
  retailTitle: string,
  amazonTitle: string
): VariantMismatchResult {
  const reasons: string[] = [];
  const retailPack = extractPackCount(retailTitle);
  const amazonPack = extractPackCount(amazonTitle);
  const retailDistinctive = distinctiveVariantTokens(retailTitle, amazonTitle);
  const amazonDistinctive = distinctiveVariantTokens(amazonTitle, retailTitle);

  if (retailPack !== amazonPack) {
    reasons.push(
      `Pack size differs (store: ${retailPack === 1 ? "single" : retailPack + "-pack"}, Amazon: ${amazonPack === 1 ? "single" : amazonPack + "-pack"}).`
    );
  }

  const retailSet = new Set(retailDistinctive);
  const amazonSet = new Set(amazonDistinctive);
  let sharedDistinctive = 0;
  for (const t of retailSet) {
    if (amazonSet.has(t)) sharedDistinctive++;
  }

  const hasRetailVariant = retailDistinctive.length >= 1;
  const hasAmazonVariant = amazonDistinctive.length >= 1;

  if (hasRetailVariant && hasAmazonVariant && sharedDistinctive === 0) {
    const retailLabel = retailDistinctive.slice(0, 4).join(", ");
    const amazonLabel = amazonDistinctive.slice(0, 4).join(", ");
    reasons.push(
      `Variant/scent keywords differ — store highlights "${retailLabel}" but Amazon shows "${amazonLabel}".`
    );
  }

  return {
    mismatched: reasons.length > 0,
    reasons,
    retailPackCount: retailPack,
    amazonPackCount: amazonPack,
    retailDistinctive,
    amazonDistinctive,
  };
}

/** Score for ranking Amazon search hits — penalize variant + edge-case mismatches. */
export function retailAmazonMatchScore(retailTitle: string, amazonTitle: string): number {
  const overlap = tokenOverlapScore(retailTitle, amazonTitle);
  const variant = detectVariantMismatch(retailTitle, amazonTitle);
  const edgePenalty = edgeCaseMatchPenalty(retailTitle, amazonTitle);
  if (variant.mismatched) return overlap * 0.35 * edgePenalty;
  return overlap * edgePenalty;
}

export function detectStoreExclusiveBrand(
  storeName: string,
  productName: string,
  scrapedBrand?: string
): { isExclusive: boolean; brandLabel: string | null } {
  const haystack = normalizeText([scrapedBrand, productName].filter(Boolean).join(" "));
  const brands: Record<string, string[]> = {
    Target: ["all in motion", "good & gather", "good and gather", "up & up", "up and up"],
    Costco: ["kirkland signature", "kirkland"],
    Walmart: ["great value", "mainstays", "bettergoods", "equate"],
    "Sam's Club": ["member's mark", "members mark"],
    Walgreens: ["nice!", "nice", "walgreens brand"],
    CVS: ["cvs health", "gold emblem", "live better"],
  };
  const list = brands[storeName] ?? [];

  for (const brand of list) {
    if (haystack.includes(brand)) {
      return { isExclusive: true, brandLabel: brand };
    }
  }

  return { isExclusive: false, brandLabel: null };
}

export function amazonBrandAppearsInRetailTitle(amazonTitle: string, retailTitle: string): boolean {
  const amazonNorm = normalizeText(amazonTitle);
  const retailTokens = [...significantTokens(retailTitle, STOP_WORDS)];

  const amazonLead = amazonNorm.split(" ").slice(0, 3).join(" ");
  if (amazonLead.length > 3 && normalizeText(retailTitle).includes(amazonLead)) {
    return true;
  }

  const amazonBrandGuess = amazonNorm.split(" ")[0];
  return retailTokens.some((t) => t === amazonBrandGuess);
}

export function assessRetailPriceSanity(
  storePrice: number,
  amazonPrice?: number
): string[] {
  return edgeCasesToWarnings(detectPriceEdgeCases(storePrice, amazonPrice));
}

export function applyPriceSanityToQuality(
  quality: RetailMatchQuality,
  storePrice: number,
  amazonPrice?: number
): RetailMatchQuality {
  const priceWarnings = assessRetailPriceSanity(storePrice, amazonPrice);
  if (priceWarnings.length === 0) return quality;

  return {
    ...quality,
    warnings: [...quality.warnings, ...priceWarnings],
    confidence: "low",
    profitAnalysisReliable: false,
    hasBlockingEdgeCases: true,
  };
}

export interface RetailMatchQuality {
  confidence: "high" | "medium" | "low";
  overlapScore: number;
  isStoreExclusiveBrand: boolean;
  storeBrandLabel: string | null;
  variantMismatch: boolean;
  profitAnalysisReliable: boolean;
  warnings: string[];
  edgeCaseCodes?: RetailEdgeCaseCode[];
  hasBlockingEdgeCases?: boolean;
}

export function assessRetailMatchQuality(
  retail: RetailProduct,
  amazonTitle: string,
  baseConfidence: "high" | "medium" | "low",
  amazonPrice?: number
): RetailMatchQuality {
  const overlapScore = tokenOverlapScore(retail.productName, amazonTitle);
  const exclusive = detectStoreExclusiveBrand(retail.storeName, retail.productName, retail.brand);
  const variant = detectVariantMismatch(retail.productName, amazonTitle);

  const edgeAssessment = assessRetailEdgeCases({
    retail,
    amazonTitle,
    amazonPrice,
    overlapScore,
    baseConfidence,
  });

  const warnings = edgeCasesToWarnings(edgeAssessment.cases);

  let confidence = baseConfidence;

  if (
    edgeAssessment.hasBlocking ||
    exclusive.isExclusive ||
    variant.mismatched ||
    overlapScore < 0.2
  ) {
    confidence = "low";
  } else if (overlapScore < 0.55 && confidence === "high") {
    confidence = "medium";
  } else if (overlapScore < 0.4 && confidence === "medium") {
    confidence = "low";
  }

  const profitAnalysisReliable =
    !edgeAssessment.hasBlocking &&
    !exclusive.isExclusive &&
    !variant.mismatched &&
    overlapScore >= 0.55 &&
    confidence === "high";

  return {
    confidence,
    overlapScore,
    isStoreExclusiveBrand: exclusive.isExclusive,
    storeBrandLabel: exclusive.brandLabel,
    variantMismatch: variant.mismatched || edgeAssessment.codes.includes("scent_variant_mismatch"),
    profitAnalysisReliable,
    warnings,
    edgeCaseCodes: edgeAssessment.codes,
    hasBlockingEdgeCases: edgeAssessment.hasBlocking,
  };
}
