import type { ScanRequest, ScanResultBase, ScanResultPro, Tier, Verdict } from "@/types";
import { buildMockScanBase, buildMockScanPro } from "@/lib/mock/mock-data";
import { recordScan } from "@/lib/db/users";
import { getProductByAsin, getProductFees } from "@/lib/amazon/catalog";
import { isAmazonEnabled } from "@/lib/amazon/client";
import { checkEligibility } from "@/lib/amazon/eligibility";

export interface RunScanParams {
  request: ScanRequest;
  tier: Tier;
  userId: string | null;
}

export interface RunScanResult {
  result: ScanResultBase | ScanResultPro;
  mock: boolean;
}

function extractAsin(req: ScanRequest): string {
  if (req.asin && req.asin.trim()) return req.asin.trim().toUpperCase();
  if (req.productUrl) {
    const match = req.productUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (match) return match[1].toUpperCase();
  }
  return "UNKNOWN";
}

function calcVerdict(params: {
  profit: number;
  rating: number;
  reviews: number;
  margin: number;
}): { verdict: Verdict; reason: string } {
  const { profit, rating, reviews, margin } = params;

  if (profit < 0) {
    return { verdict: "RISK", reason: `Estimated net profit is negative ($${profit.toFixed(2)}). After Amazon fees, this product loses money at the current price.` };
  }
  if (margin < 15) {
    return { verdict: "RISK", reason: `Margin is only ${margin.toFixed(1)}% — below the 15% threshold needed to absorb returns and PPC costs.` };
  }
  if (rating < 3.5 && reviews > 50) {
    return { verdict: "RISK", reason: `Low rating (${rating.toFixed(1)}★ from ${reviews} reviews) suggests product quality issues.` };
  }
  if (profit > 10 && margin >= 25 && rating >= 4.0) {
    return { verdict: "BUY", reason: `Strong margin (${margin.toFixed(1)}%), healthy profit ($${profit.toFixed(2)}/unit), and solid rating (${rating.toFixed(1)}★).` };
  }
  return { verdict: "SKIP", reason: `Moderate opportunity — $${profit.toFixed(2)} profit at ${margin.toFixed(1)}% margin.` };
}

export async function runScan({ request, tier, userId }: RunScanParams): Promise<RunScanResult> {
  const asin = extractAsin(request);
  let base: ScanResultBase;
  let pro: ScanResultPro | null = null;
  let mock = true;

  if (isAmazonEnabled() && asin !== "UNKNOWN") {
    try {
      console.log(`[scan] fetching real Amazon data for ${asin}`);
      const product = await getProductByAsin(asin);

      if (product) {
        const cost = request.cost ?? 0;
        const fees = await getProductFees(asin, product.price);
        const totalFees = fees?.totalFees ?? product.price * 0.15 + 4.5;
        const netProfit = product.price - totalFees - cost;
        const margin = product.price > 0 ? (netProfit / product.price) * 100 : 0;
        const roi = cost > 0 ? (netProfit / cost) * 100 : 0;
        const eligibility = await checkEligibility(asin);

        const { verdict, reason } = calcVerdict({
          profit: netProfit,
          rating: product.rating,
          reviews: product.reviews,
          margin,
        });

        base = {
          asin: product.asin,
          title: product.title,
          verdict,
          verdictReason: reason,
          price: product.price,
          rating: product.rating,
          reviewCount: product.reviews,
          category: product.category,
          isMock: false,
          generatedAt: new Date().toISOString(),
          eligibility: eligibility.status,        
          eligibilityReason: eligibility.reason,
        };

        if (tier === "pro") {
          pro = {
            ...base,
            estimatedFees: fees ? {
              referralFee: fees.referralFee,
              fbaFee: fees.fbaFee,
              totalFees: fees.totalFees,
            } : {
              referralFee: 0,
              fbaFee: 0,
              totalFees: totalFees,
            },
            profit: {
              unitCost: cost,
              netProfit,
              marginPercent: margin,
              roiPercent: roi,
            },
            competition: {
              sellerCount: 0,
              buyBoxPrice: product.price,
              competitionLevel: product.reviews > 500 ? "high" : product.reviews > 100 ? "medium" : "low",
            },
          };
        }

        mock = false;
        console.log(`[scan] real data fetched for ${asin}, verdict: ${verdict}`);
      } else {
        console.warn(`[scan] product not found for ${asin}, falling back to mock`);
      }
    } catch (err) {
      console.error(`[scan] Amazon API call failed for ${asin}, falling back to mock:`, err);
    }
  } else {
    console.log(`[scan] Amazon disabled or unknown ASIN, using mock`);
  }

  if (mock) {
    base = buildMockScanBase(asin);
    if (tier === "pro") {
      pro = buildMockScanPro(asin, request.cost);
    }
  }

  void recordScan({ userId, asin, tier, verdict: base!.verdict }).catch((err) => {
    console.error("[scan] recordScan failed (non-fatal):", err);
  });

  return {
    result: tier === "pro" && pro ? pro : base!,
    mock,
  };
}