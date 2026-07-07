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

export interface RunRetailScanParams {
  retailUrl: string;
  cost?: number;
  tier: Tier;
  userId: string | null;
}

export interface RunRetailScanResult {
  result: ScanResultBase | ScanResultPro;
  mock: boolean;
}

export async function runRetailScan({
  retailUrl,
  cost,
  tier,
  userId,
}: RunRetailScanParams): Promise<RunRetailScanResult> {

  console.log(`[retail-scan] starting retail scan for: ${retailUrl}`);

  // 1단계: 소매점 상품 정보 스크래핑
  const retailProduct = await scrapeRetailProduct(retailUrl);

  if (!retailProduct) {
    console.warn("[retail-scan] could not scrape retail product, returning mock");
    const base = buildMockScanBase("RETAIL");
    return { result: base, mock: true };
  }

  console.log(`[retail-scan] retail: ${retailProduct.storeName} $${retailProduct.storePrice} — "${retailProduct.productName}"`);

  // 2단계: Amazon에서 같은 상품 찾기
  const amazonMatch = await findAmazonMatch(retailProduct.productName);

  if (!amazonMatch) {
    console.warn("[retail-scan] could not find Amazon match, returning mock");
    const base = buildMockScanBase("RETAIL");
    return { result: base, mock: true };
  }

  console.log(`[retail-scan] Amazon match: ${amazonMatch.asin} — "${amazonMatch.title}"`);

  // 3단계: 소매점 구매가를 원가로 넣어서 기존 스캔 실행
  const { result, mock } = await runScan({
    request: {
      asin: amazonMatch.asin,
      cost: cost ?? retailProduct.storePrice, // 소매점 가격이 원가
    },
    tier,
    userId,
  });

  // 4단계: 결과에 소매점 비교 정보 추가
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

  return { result: enrichedResult as any, mock };
}