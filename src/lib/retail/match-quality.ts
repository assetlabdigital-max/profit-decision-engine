/**
 * src/lib/retail/match-quality.ts
 *
 * Assesses how trustworthy a retail → Amazon product match is.
 */

import type { RetailProduct } from "@/lib/retail/types";

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
  Walgreens: ["nice!", "nice", "walgreens brand"],
  CVS: ["cvs health", "gold emblem", "live better"],
};

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

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s&-]/g, " ")
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

/** Parse multi-pack from title (default single item = 1). */
export function extractPackCount(title: string): number {
  const norm = normalizeText(title);

  const explicit = norm.match(/(\d+)\s*pack\b/);
  if (explicit) return Math.max(1, parseInt(explicit[1], 10));

  if (/\b(twin|duo|double)\s+pack\b/.test(norm) || /\b2\s+pack\b/.test(norm)) return 2;
  if (/\b3\s+pack\b/.test(norm) || /\btriple\s+pack\b/.test(norm)) return 3;
  if (/\b4\s+pack\b/.test(norm)) return 4;

  if (/\bset\s+of\s+(\d+)\b/.test(norm)) {
    const m = norm.match(/\bset\s+of\s+(\d+)\b/);
    if (m) return Math.max(1, parseInt(m[1], 10));
  }

  if (/\bvariety\s+pack\b/.test(norm) || /\bassorted\b/.test(norm)) return 2;

  return 1;
}

/** Tokens that distinguish scent/color/style — present in one title but not the other. */
function distinctiveVariantTokens(title: string, otherTitle: string): string[] {
  const tokens = significantTokens(title);
  const other = significantTokens(otherTitle);
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

/** Score for ranking Amazon search hits — penalize variant mismatches. */
export function retailAmazonMatchScore(retailTitle: string, amazonTitle: string): number {
  const overlap = tokenOverlapScore(retailTitle, amazonTitle);
  const variant = detectVariantMismatch(retailTitle, amazonTitle);
  if (variant.mismatched) return overlap * 0.35;
  return overlap;
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
  variantMismatch: boolean;
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
  const variant = detectVariantMismatch(retail.productName, amazonTitle);

  if (exclusive.isExclusive) {
    warnings.push(
      `"${exclusive.brandLabel}" is a ${retail.storeName} store brand — it usually has no identical Amazon listing. The matched ASIN is likely a similar product, not the same item.`
    );
  }

  for (const reason of variant.reasons) {
    warnings.push(`Variant mismatch: ${reason}`);
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

  if (exclusive.isExclusive || variant.mismatched || overlapScore < 0.2) {
    confidence = "low";
  } else if (overlapScore < 0.55 && confidence === "high") {
    confidence = "medium";
  } else if (overlapScore < 0.4 && confidence === "medium") {
    confidence = "low";
  }

  const profitAnalysisReliable =
    !exclusive.isExclusive &&
    !variant.mismatched &&
    overlapScore >= 0.55 &&
    confidence === "high";

  return {
    confidence,
    overlapScore,
    isStoreExclusiveBrand: exclusive.isExclusive,
    storeBrandLabel: exclusive.brandLabel,
    variantMismatch: variant.mismatched,
    profitAnalysisReliable,
    warnings,
  };
}
