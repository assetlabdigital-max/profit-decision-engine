/**
 * src/lib/scan/run-retail-scan.ts
 *
 * NODE RUNTIME. Orchestrates retail URL → Amazon match → scan flow.
 * 1. Scrape retail store for product name + price
 * 2. Search Amazon for matching ASIN
 * 3. Run full scan on that ASIN
 * 4. Add retail arbitrage comparison to result
 */

import { scrapeRetailProduct } from "@/lib/retail/scraper";
import { findAmazonMatch } from "@/lib/retail/amazon-match";
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
    return { result: base, mock: true, fallbackReason: "retail_scrape_failed" };
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

  console.log(`[retail-scan] Amazon match: ${amazonMatch.asin} — "${amazonMatch.title}"`);

  const { result, mock } = await runScan({
    request: {
      asin: amazonMatch.asin,
      cost: cost ?? retailProduct.storePrice,
    },
    tier,
    userId,
  });

  const enrichedResult = {
    ...result,
    retailArbitrage: {
      storeName: retailProduct.storeName,
      storePrice: retailProduct.storePrice,
      storeProductName: retailProduct.productName,
      amazonTitle: amazonMatch.title,
      matchConfidence: amazonMatch.confidence,
    },
  };

  return { result: enrichedResult as ScanResultBase | ScanResultPro, mock, fallbackReason: null };
}
