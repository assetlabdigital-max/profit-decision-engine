import type {
  ScanRequest,
  ScanResultBase,
  ScanResultPro,
  Tier,
} from "@/types";

import { buildMockScanPro } from "@/lib/mock/mock-data";
import { recordScan } from "@/lib/db/users";
import { fetchAmazonProduct } from "@/lib/amazon/client";

import { calculateMargin } from "./margin";
import { calculateCompetition } from "./competition";

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
  if (req.asin?.trim()) return req.asin.trim().toUpperCase();

  if (req.productUrl) {
    const match = req.productUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (match) return match[1].toUpperCase();
  }

  return "UNKNOWN";
}

export async function runScan({
  request,
  tier,
  userId,
}: RunScanParams): Promise<RunScanResult> {
  const asin = extractAsin(request);
  const isPro = tier === "pro";

  let mock = false;

  let base: ScanResultBase;
  let pro: ScanResultPro | null = null;

  try {
    const amazon = isPro
      ? await fetchAmazonProduct(asin)
      : {
          asin,
          title: `Mock Product ${asin}`,
          price: Math.floor(Math.random() * 50) + 10,
          rating: 4 + Math.random(),
          reviews: Math.floor(Math.random() * 1000),
        };

    const marginData = calculateMargin(amazon.price, request.cost ?? 0);

    const competition = calculateCompetition(
      amazon.reviews ?? 0,
      amazon.rating ?? 0
    );

    let verdict: "BUY" | "SKIP" | "RISK" = "SKIP";

    if (isPro) {
      if (marginData.margin > 0.25 && competition.level === "low") {
        verdict = "BUY";
      } else if (marginData.margin > 0.1) {
        verdict = "SKIP";
      } else {
        verdict = "RISK";
      }
    }

    const verdictReason = isPro
      ? verdict === "BUY"
        ? "High margin + low competition"
        : verdict === "SKIP"
        ? "Moderate opportunity"
        : "Low margin or high competition"
      : "Upgrade to Pro for full analysis";

    base = {
      asin: amazon.asin,
      title: amazon.title,
      price: amazon.price,

      rating: amazon.rating ?? 0,
      reviewCount: amazon.reviews ?? 0,

      category: "Amazon",
      isMock: !isPro,
      generatedAt: new Date().toISOString(),

      verdict,
      verdictReason,

      netMargin: isPro ? marginData.margin : undefined,
      roi: isPro ? marginData.roi : undefined,
      fees: isPro ? marginData.fees.totalFees : undefined,

      competition: isPro
        ? competition.level
        : undefined,
    };

    if (isPro) {
      pro = buildMockScanPro(asin, request.cost);
    }
  } catch (err) {
    console.error("[scan] system error fallback:", err);

    base = {
      asin: asin || "UNKNOWN",
      title: "Scan temporarily unavailable",

      verdict: "RISK",
      verdictReason: "System fallback activated",

      price: 0,
      rating: 0,
      reviewCount: 0,

      category: "Unknown",
      isMock: true,
      generatedAt: new Date().toISOString(),
    };

    mock = true;
  }

  void recordScan({
    userId,
    asin,
    tier,
    verdict: base.verdict,
  }).catch(() => {});

  return {
    result: isPro && pro ? pro : base,
    mock,
  };
}
