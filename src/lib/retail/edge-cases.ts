/**
 * Retail ↔ Amazon arbitrage edge-case detection.
 *
 * Covers many exceptional situations beyond a single variant mismatch example
 * (e.g. eos scent/pack) — size, volume, condition, bundles, refurbished, etc.
 */

import type { RetailProduct } from "@/lib/retail/types";
import {
  normalizeText,
  extractPackCount,
  extractUnitCount,
  extractVolumeFlOz,
  extractWeightOz,
  extractColors,
  extractSizes,
  extractModelTokens,
} from "@/lib/retail/title-parse";

export type EdgeCaseSeverity = "block" | "warn";

export type RetailEdgeCaseCode =
  | "pack_mismatch"
  | "scent_variant_mismatch"
  | "volume_mismatch"
  | "weight_mismatch"
  | "unit_count_mismatch"
  | "color_mismatch"
  | "size_mismatch"
  | "model_number_mismatch"
  | "condition_mismatch"
  | "bundle_gift_set"
  | "subscription_listing"
  | "variety_assorted"
  | "travel_sample_size"
  | "store_exclusive_brand"
  | "brand_title_mismatch"
  | "low_title_overlap"
  | "weak_amazon_match"
  | "suspicious_store_price"
  | "suspicious_scrape_title"
  | "member_pricing_unclear"
  | "amazon_refurbished_used"
  | "per_unit_price_risk"
  | "multi_item_bundle"
  | "generational_mismatch";

export interface RetailEdgeCase {
  code: RetailEdgeCaseCode;
  severity: EdgeCaseSeverity;
  message: string;
}

export interface EdgeCaseAssessment {
  cases: RetailEdgeCase[];
  hasBlocking: boolean;
  codes: RetailEdgeCaseCode[];
}

const STORE_EXCLUSIVE_BRANDS: Record<string, string[]> = {
  Target: [
    "all in motion", "good & gather", "good and gather", "up & up", "up and up",
    "cat & jack", "wild fable", "universal thread", "a new day", "shade & shore",
  ],
  Costco: ["kirkland signature", "kirkland"],
  Walmart: ["great value", "mainstays", "bettergoods", "equate"],
  "Sam's Club": ["member's mark", "members mark"],
  Walgreens: ["nice!", "nice", "walgreens brand"],
  CVS: ["cvs health", "gold emblem", "live better"],
};

const PRODUCT_LINE_WORDS = new Set([
  "new", "free", "set", "pack", "count", "ct", "fluid", "ounce", "ounces",
  "body", "lotion", "moisture", "moisturizing", "moisturizer", "cream", "wash",
  "shampoo", "conditioner", "spray", "serum", "gel", "oil", "soap", "candle",
  "chair", "desk", "table", "shirt", "pants", "jogger", "joggers", "cargo",
  "active", "light", "mid", "rise", "better", "shea", "hour", "24h", "24",
  "fl", "oz", "inch", "inches", "large", "medium", "small", "extra",
  "ultra", "super", "premium", "original", "classic", "daily", "night", "day",
]);

const CONDITION_WORDS = [
  "renewed", "refurbished", "open box", "open-box", "used", "pre-owned",
  "pre owned", "certified refurbished", "recertified",
];

const BUNDLE_WORDS = [
  "gift set", "starter kit", "value set", "bundle", "collection", "combo",
  "twin pack", "multi item", "kit includes", "with bonus",
];

const SUBSCRIPTION_WORDS = [
  "subscribe", "subscription", "auto-delivery", "auto delivery", "autoship",
  "refill only", "replacement cartridge",
];

const VARIETY_WORDS = ["variety pack", "assorted", "multi flavor", "sampler"];

const TRAVEL_SAMPLE_WORDS = [
  "travel size", "travel-size", "trial size", "sample size", "mini size", "miniature",
];

const GENERATION_WORDS = [
  ["pro", "max"], ["series", "se"], ["gen", "generation"], ["v2", "v3"], ["2023", "2024", "2025"],
];

function addCase(
  cases: RetailEdgeCase[],
  code: RetailEdgeCaseCode,
  severity: EdgeCaseSeverity,
  message: string
): void {
  if (cases.some((c) => c.code === code)) return;
  cases.push({ code, severity, message });
}

function distinctiveVariantTokens(title: string, otherTitle: string): string[] {
  const tokens = normalizeText(title).split(" ").filter((t) => t.length > 2);
  const other = new Set(normalizeText(otherTitle).split(" "));
  const distinctive: string[] = [];

  for (const token of tokens) {
    if (other.has(token)) continue;
    if (PRODUCT_LINE_WORDS.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    distinctive.push(token);
  }

  return distinctive;
}

function detectScentVariantMismatch(retailTitle: string, amazonTitle: string): string | null {
  const retailDistinctive = distinctiveVariantTokens(retailTitle, amazonTitle);
  const amazonDistinctive = distinctiveVariantTokens(amazonTitle, retailTitle);

  if (retailDistinctive.length >= 1 && amazonDistinctive.length >= 1) {
    const retailSet = new Set(retailDistinctive);
    let shared = 0;
    for (const t of amazonDistinctive) {
      if (retailSet.has(t)) shared++;
    }
    if (shared === 0) {
      const retailLabel = retailDistinctive.slice(0, 4).join(", ");
      const amazonLabel = amazonDistinctive.slice(0, 4).join(", ");
      return `Scent/style keywords differ — store: "${retailLabel}" vs Amazon: "${amazonLabel}".`;
    }
  }

  return null;
}

function numericMismatch(
  retailVal: number | null,
  amazonVal: number | null,
  toleranceRatio: number
): boolean {
  if (retailVal == null || amazonVal == null) return false;
  if (retailVal <= 0 || amazonVal <= 0) return false;
  const ratio = retailVal / amazonVal;
  return ratio < 1 - toleranceRatio || ratio > 1 + toleranceRatio;
}

function titleHasAny(title: string, phrases: string[]): boolean {
  const norm = normalizeText(title);
  return phrases.some((p) => norm.includes(p));
}

function detectStoreExclusive(
  storeName: string,
  productName: string,
  brand?: string
): string | null {
  const haystack = normalizeText([brand, productName].filter(Boolean).join(" "));
  const brands = STORE_EXCLUSIVE_BRANDS[storeName] ?? [];
  for (const b of brands) {
    if (haystack.includes(b)) return b;
  }
  return null;
}

function detectPairingEdgeCases(retailTitle: string, amazonTitle: string): RetailEdgeCase[] {
  const cases: RetailEdgeCase[] = [];

  const retailPack = extractPackCount(retailTitle);
  const amazonPack = extractPackCount(amazonTitle);
  if (retailPack !== amazonPack) {
    addCase(
      cases,
      "pack_mismatch",
      "block",
      `Pack count differs (store: ${retailPack === 1 ? "single" : retailPack + "-pack"}, Amazon: ${amazonPack === 1 ? "single" : amazonPack + "-pack"}).`
    );
  }

  const scentReason = detectScentVariantMismatch(retailTitle, amazonTitle);
  if (scentReason) {
    addCase(cases, "scent_variant_mismatch", "block", scentReason);
  }

  const retailVol = extractVolumeFlOz(retailTitle);
  const amazonVol = extractVolumeFlOz(amazonTitle);
  if (numericMismatch(retailVol, amazonVol, 0.08)) {
    addCase(
      cases,
      "volume_mismatch",
      "block",
      `Volume/size differs (${retailVol?.toFixed(1)} fl oz vs ${amazonVol?.toFixed(1)} fl oz) — likely a different SKU.`
    );
  }

  const retailWt = extractWeightOz(retailTitle);
  const amazonWt = extractWeightOz(amazonTitle);
  if (numericMismatch(retailWt, amazonWt, 0.1)) {
    addCase(
      cases,
      "weight_mismatch",
      "block",
      `Weight differs (${retailWt?.toFixed(1)} oz vs ${amazonWt?.toFixed(1)} oz) — likely a different SKU.`
    );
  }

  const retailUnits = extractUnitCount(retailTitle);
  const amazonUnits = extractUnitCount(amazonTitle);
  if (retailUnits != null && amazonUnits != null && retailUnits !== amazonUnits) {
    addCase(
      cases,
      "unit_count_mismatch",
      "block",
      `Unit count differs (store: ${retailUnits} vs Amazon: ${amazonUnits}) — multipack vs single-item risk.`
    );
  }

  const retailColors = extractColors(retailTitle);
  const amazonColors = extractColors(amazonTitle);
  if (retailColors.size > 0 && amazonColors.size > 0) {
    let sharedColor = false;
    for (const c of retailColors) {
      if (amazonColors.has(c)) sharedColor = true;
    }
    if (!sharedColor) {
      addCase(
        cases,
        "color_mismatch",
        "block",
        `Color differs (store: ${[...retailColors].join("/")} vs Amazon: ${[...amazonColors].join("/")}).`
      );
    }
  }

  const retailSizes = extractSizes(retailTitle);
  const amazonSizes = extractSizes(amazonTitle);
  if (retailSizes.size > 0 && amazonSizes.size > 0) {
    let sharedSize = false;
    for (const s of retailSizes) {
      if (amazonSizes.has(s)) sharedSize = true;
    }
    if (!sharedSize) {
      addCase(
        cases,
        "size_mismatch",
        "block",
        `Size differs (store: ${[...retailSizes].join("/")} vs Amazon: ${[...amazonSizes].join("/")}).`
      );
    }
  }

  const retailModels = extractModelTokens(retailTitle);
  const amazonModels = extractModelTokens(amazonTitle);
  if (retailModels.size > 0 && amazonModels.size > 0) {
    let sharedModel = false;
    for (const m of retailModels) {
      if (amazonModels.has(m)) sharedModel = true;
    }
    if (!sharedModel) {
      addCase(
        cases,
        "model_number_mismatch",
        "block",
        `Model/SKU tokens differ — verify electronics/appliance model numbers manually.`
      );
    }
  }

  if (titleHasAny(amazonTitle, CONDITION_WORDS)) {
    addCase(
      cases,
      "amazon_refurbished_used",
      "block",
      "Amazon listing appears renewed/refurbished/used — not comparable to new retail inventory."
    );
  }

  const retailBundle = titleHasAny(retailTitle, BUNDLE_WORDS);
  const amazonBundle = titleHasAny(amazonTitle, BUNDLE_WORDS);
  if (retailBundle || amazonBundle) {
    addCase(
      cases,
      retailBundle && amazonBundle ? "bundle_gift_set" : "multi_item_bundle",
      "block",
      "One or both listings look like a bundle/gift set — item contents may not match 1:1."
    );
  }

  if (titleHasAny(amazonTitle, SUBSCRIPTION_WORDS) || titleHasAny(retailTitle, SUBSCRIPTION_WORDS)) {
    addCase(
      cases,
      "subscription_listing",
      "warn",
      "Subscription/auto-delivery or refill-only listing — unit economics may not apply to one-time arbitrage."
    );
  }

  if (titleHasAny(retailTitle, VARIETY_WORDS) !== titleHasAny(amazonTitle, VARIETY_WORDS)) {
    addCase(
      cases,
      "variety_assorted",
      "block",
      "Variety/assorted pack on one side only — flavors or SKUs inside may differ."
    );
  }

  if (titleHasAny(retailTitle, TRAVEL_SAMPLE_WORDS) !== titleHasAny(amazonTitle, TRAVEL_SAMPLE_WORDS)) {
    addCase(
      cases,
      "travel_sample_size",
      "block",
      "Travel/sample/mini size on one side only — not the same sellable unit."
    );
  }

  for (const [a, b] of GENERATION_WORDS) {
    const retailHasA = normalizeText(retailTitle).includes(a);
    const retailHasB = normalizeText(retailTitle).includes(b);
    const amazonHasA = normalizeText(amazonTitle).includes(a);
    const amazonHasB = normalizeText(amazonTitle).includes(b);
    if ((retailHasA && amazonHasB) || (retailHasB && amazonHasA)) {
      addCase(
        cases,
        "generational_mismatch",
        "block",
        `Product generation/tier may differ (${a} vs ${b}) — common with electronics and consoles.`
      );
      break;
    }
  }

  return cases;
}

function detectRetailScrapeEdgeCases(retail: RetailProduct): RetailEdgeCase[] {
  const cases: RetailEdgeCase[] = [];
  const title = retail.productName.trim();

  if (title.length < 8) {
    addCase(
      cases,
      "suspicious_scrape_title",
      "block",
      "Store product title is very short — scrape may have hit a category or error page."
    );
  }

  const suspectPhrases = [
    "product details", "page not found", "unavailable", "see price in store",
    "add to cart for price", "choose options", "select items",
  ];
  if (titleHasAny(title, suspectPhrases)) {
    addCase(
      cases,
      "suspicious_scrape_title",
      "block",
      "Store title looks like a placeholder or unavailable product page."
    );
  }

  const exclusive = detectStoreExclusive(retail.storeName, retail.productName, retail.brand);
  if (exclusive) {
    addCase(
      cases,
      "store_exclusive_brand",
      "block",
      `"${exclusive}" is a ${retail.storeName} store brand — usually no identical Amazon listing exists.`
    );
  }

  if (retail.storeName === "Costco" || retail.storeName === "Sam's Club") {
    addCase(
      cases,
      "member_pricing_unclear",
      "warn",
      `${retail.storeName} often shows member/warehouse pricing — online or non-member cost may be higher.`
    );
  }

  if (normalizeText(title).includes("per ") || /\d+\s*\/\s*\$/.test(title)) {
    addCase(
      cases,
      "per_unit_price_risk",
      "warn",
      "Store title suggests a per-unit or fractional price — scraped cost may not be the full item price."
    );
  }

  return cases;
}

function detectMatchQualityEdgeCases(
  overlapScore: number,
  baseConfidence: "high" | "medium" | "low",
  retailTitle: string,
  amazonTitle: string
): RetailEdgeCase[] {
  const cases: RetailEdgeCase[] = [];

  if (overlapScore < 0.25) {
    addCase(
      cases,
      "low_title_overlap",
      "block",
      `Low title similarity (${Math.round(overlapScore * 100)}%) — Amazon match is unreliable.`
    );
  } else if (overlapScore < 0.4 || baseConfidence === "low") {
    addCase(
      cases,
      "weak_amazon_match",
      "warn",
      `Moderate/weak Amazon match (${Math.round(overlapScore * 100)}% overlap) — confirm ASIN manually.`
    );
  }

  const retailLead = normalizeText(retailTitle).split(" ").slice(0, 2).join(" ");
  const amazonLead = normalizeText(amazonTitle).split(" ").slice(0, 2).join(" ");
  if (
    retailLead.length > 3 &&
    amazonLead.length > 3 &&
    !normalizeText(retailTitle).includes(amazonLead) &&
    !normalizeText(amazonTitle).includes(retailLead)
  ) {
    addCase(
      cases,
      "brand_title_mismatch",
      "warn",
      "Leading brand/product words differ between store and Amazon titles."
    );
  }

  return cases;
}

export function detectPriceEdgeCases(storePrice: number, amazonPrice?: number): RetailEdgeCase[] {
  const cases: RetailEdgeCase[] = [];

  if (!Number.isFinite(storePrice) || storePrice <= 0) {
    addCase(cases, "suspicious_store_price", "block", "Store price is missing or zero.");
    return cases;
  }

  if (storePrice > 500) {
    addCase(
      cases,
      "suspicious_store_price",
      "warn",
      `Store price ($${storePrice.toFixed(2)}) is unusually high — may be a bundle or scrape error.`
    );
  }

  if (amazonPrice != null && amazonPrice > 0) {
    if (storePrice > amazonPrice * 3) {
      addCase(
        cases,
        "suspicious_store_price",
        "block",
        `Store price ($${storePrice.toFixed(2)}) is much higher than Amazon ($${amazonPrice.toFixed(2)}) — scrape likely wrong.`
      );
    }
    if (storePrice < amazonPrice * 0.05) {
      addCase(
        cases,
        "per_unit_price_risk",
        "block",
        `Store price ($${storePrice.toFixed(2)}) is far below Amazon ($${amazonPrice.toFixed(2)}) — likely per-unit or promo pricing.`
      );
    }
  }

  return cases;
}

export function assessRetailEdgeCases(params: {
  retail: RetailProduct;
  amazonTitle: string;
  amazonPrice?: number;
  overlapScore: number;
  baseConfidence: "high" | "medium" | "low";
}): EdgeCaseAssessment {
  const cases: RetailEdgeCase[] = [
    ...detectRetailScrapeEdgeCases(params.retail),
    ...detectPairingEdgeCases(params.retail.productName, params.amazonTitle),
    ...detectMatchQualityEdgeCases(
      params.overlapScore,
      params.baseConfidence,
      params.retail.productName,
      params.amazonTitle
    ),
    ...detectPriceEdgeCases(params.retail.storePrice, params.amazonPrice),
  ];

  const hasBlocking = cases.some((c) => c.severity === "block");

  return {
    cases,
    hasBlocking,
    codes: cases.map((c) => c.code),
  };
}

/** Penalty multiplier for Amazon search ranking (0–1). */
export function edgeCaseMatchPenalty(retailTitle: string, amazonTitle: string): number {
  const pairing = detectPairingEdgeCases(retailTitle, amazonTitle);
  let penalty = 1;
  for (const c of pairing) {
    penalty *= c.severity === "block" ? 0.25 : 0.7;
  }
  return penalty;
}

export function edgeCasesToWarnings(cases: RetailEdgeCase[]): string[] {
  return cases.map((c) =>
    c.severity === "block" ? `⛔ ${c.message}` : `⚠️ ${c.message}`
  );
}
