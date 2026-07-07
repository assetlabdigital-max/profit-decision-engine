/**
 * src/lib/scan/run-retail-scan.ts
 *
 * NODE RUNTIME. Orchestrates retail URL → Amazon match → scan flow.
 */

import { scrapeRetailProduct, getLastRetailScrapeError } from "@/lib/retail/scraper";
import { findAmazonMatch } from "@/lib/retail/amazon-match";
import { assessRetailMatchQuality } from "@/lib/retail/match-quality";
import { runScan } from "@/lib/scan/run-scan";
import { buildMockScanBase } from "@/lib/mock/mock-data";
import type { Tier, ScanResultBase, ScanResultPro } from "@/types";

export type RetailScanFallbackReason =
  | "retail_scrape_failed"
  | "amazon_match_failed"
  | null;

export interface RunRetailScanParams {
  retailUrl: string;
  cost?: number;
  tier: Tier;
  userId: string | null;
}

export interface RunRetailScanResult {
  result: ScanResultBase | ScanResultPro;
  mock: boolean;
  fallbackReason: RetailScanFallbackReason;
  scrapeError?: string;
}

function applyRetailQualityGuards(
  result: ScanResultBase | ScanResultPro,
  quality: ReturnType<typeof assessRetailMatchQuality>
): ScanResultBase | ScanResultPro {
  const priceOk = result.amazonPriceAvailable !== false && result.price > 0;
  const matchOk = quality.profitAnalysisReliable;
  const reliable = priceOk && matchOk;

  if (reliable) {
    return { ...result, profitAnalysisReliable: true };
  }

  const reasons: string[] = [];
  if (!priceOk) {
    reasons.push(
      "Amazon live price is unavailable — arbitrage profit cannot be calculated from $0.00."
    );
  }
  if (!matchOk && quality.warnings[0]) {
    reasons.push(quality.warnings[0]);
  } else if (!matchOk) {
    reasons.push("The Amazon match is too weak to trust for arbitrage.");
  }

  const patch = {
    verdict: "SKIP" as const,
    verdictReason: reasons.join(" "),
    profitAnalysisReliable: false as const,
    amazonPriceAvailable: priceOk,
  };

  if ("profit" in result) {
    const {
      profit: _p,
      estimatedFees: _e,
      competition: _c,
      ...baseFields
    } = result;
    return { ...baseFields, ...patch };
  }

  return { ...result, ...patch };
}

export async function runRetailScan({
  retailUrl,
  cost,
  tier,
  userId,
}: RunRetailScanParams): Promise<RunRetailScanResult> {
  console.log(`[retail-scan] starting retail scan for: ${retailUrl}`);

  const retailProduct = await scrapeRetailProduct(retailUrl);

  if (!retailProduct) {
    console.warn("[retail-scan] could not scrape retail product, returning mock");
    const base = buildMockScanBase("RETAIL");
    return {
      result: base,
      mock: true,
      fallbackReason: "retail_scrape_failed",
      scrapeError: getLastRetailScrapeError() ?? undefined,
    };
  }

  console.log(
    `[retail-scan] retail: ${retailProduct.storeName} $${retailProduct.storePrice} — "${retailProduct.productName}"`
  );

  const amazonMatch = await findAmazonMatch(retailProduct.productName, retailProduct.brand);

  if (!amazonMatch) {
    console.warn("[retail-scan] could not find Amazon match, returning mock");
    const base = buildMockScanBase("RETAIL");
    return { result: base, mock: true, fallbackReason: "amazon_match_failed" };
  }

  const quality = assessRetailMatchQuality(
    retailProduct,
    amazonMatch.title,
    amazonMatch.confidence
  );

  console.log(
    `[retail-scan] Amazon match: ${amazonMatch.asin} — confidence=${quality.confidence}, overlap=${quality.overlapScore.toFixed(2)}`
  );

  const { result, mock } = await runScan({
    request: {
      asin: amazonMatch.asin,
      cost: cost ?? retailProduct.storePrice,
    },
    tier,
    userId,
  });

  const withArbitrage = {
    ...result,
    retailArbitrage: {
      storeName: retailProduct.storeName,
      storePrice: retailProduct.storePrice,
      storeProductName: retailProduct.productName,
      amazonTitle: amazonMatch.title,
      matchConfidence: quality.confidence,
      matchWarnings: quality.warnings,
      storeBrand: quality.storeBrandLabel,
      isStoreExclusiveBrand: quality.isStoreExclusiveBrand,
      variantMismatch: quality.variantMismatch,
      titleOverlapScore: quality.overlapScore,
    },
  };

  const finalResult = applyRetailQualityGuards(withArbitrage, quality);

  return { result: finalResult, mock, fallbackReason: null };
}
