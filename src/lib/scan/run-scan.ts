import type {
  ScanRequest,
  ScanResultBase,
  ScanResultPro,
  Tier,
} from "@/types";

import { fetchAmazonProduct } from "@/lib/amazon/client";
import { calculateMargin } from "./margin";
import { calculateCompetition } from "./competition";
import { buildMockScanPro } from "@/lib/mock/mock-data";
import { recordScan } from "@/lib/db/users";

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

  // 🔥 STEP 8 DEBUG TRACE (ENTRY)
  console.log("====================================");
  console.log("[runScan DEBUG] START");
  console.log("[runScan DEBUG] tier =", tier);
  console.log("[runScan DEBUG] isPro =", isPro);
  console.log("[runScan DEBUG] asin =", asin);
  console.log("====================================");

  let mock = false;

  let base: ScanResultBase;
  let pro: ScanResultPro | null = null;

  try {
    // 🔥 CRITICAL: APIFY CALL DECISION TRACE
    console.log("[runScan DEBUG] about to decide data source...");

    const FORCE_REAL_APIFY = false; // change to true for hard debug mode

    const shouldUseApify = FORCE_REAL_APIFY || isPro;

    console.log("[runScan DEBUG] FORCE_REAL_APIFY =", FORCE_REAL_APIFY);
    console.log("[runScan DEBUG] shouldUseApify =", shouldUseApify);

    console.log("[runScan DEBUG] calling data layer...");

    const amazon = shouldUseApify
      ? await fetchAmazonProduct(asin)
      : {
          asin,
          title: `Mock Product ${asin}`,
          price: Math.floor(Math.random() * 50) + 10,
          rating: 4 + Math.random(),
          reviews: Math.floor(Math.random() * 1000),
        };

    console.log("[runScan DEBUG] AMAZON RAW RESULT =", amazon);

    const marginData = calculateMargin(amazon.price, request.cost ?? 0);
    const competition = calculateCompetition(
      amazon.reviews ?? 0,
      amazon.rating ?? 0
    );

    const competitionLevel: "low" | "medium" | "high" =
      competition.level === "low" ||
      competition.level === "medium" ||
      competition.level === "high"
        ? competition.level
        : "low";

    const verdict: "BUY" | "SKIP" | "RISK" =
      marginData.margin > 0.25 && competitionLevel === "low"
        ? "BUY"
        : marginData.margin > 0.1
        ? "SKIP"
        : "RISK";

    const verdictReason =
      verdict === "BUY"
        ? "High margin + low competition"
        : verdict === "SKIP"
        ? "Moderate opportunity"
        : "Low margin or high competition";

    base = {
      asin: amazon.asin,
      title: amazon.title,

      price: amazon.price,
      rating: amazon.rating ?? 0,
      reviewCount: amazon.reviews ?? 0,

      category: "Amazon",

      // 🔥 FIXED LOGIC (IMPORTANT)
      isMock: !shouldUseApify,

      generatedAt: new Date().toISOString(),

      verdict,
      verdictReason,

      netMargin: shouldUseApify ? marginData.margin : undefined,
      roi: shouldUseApify ? marginData.roi : undefined,
      fees: shouldUseApify ? marginData.fees.totalFees : undefined,

      competition: shouldUseApify ? competitionLevel : undefined,
    };

    if (shouldUseApify && isPro) {
      pro = buildMockScanPro(asin, request.cost);
    }
  } catch (err) {
    console.error("[scan] fallback triggered:", err);

    base = {
      asin,
      title: "Scan temporarily unavailable",
      price: 0,
      rating: 0,
      reviewCount: 0,
      category: "Unknown",
      isMock: true,
      generatedAt: new Date().toISOString(),
      verdict: "RISK",
      verdictReason: "System fallback activated",
    };

    mock = true;
  }

  void recordScan({
    userId,
    asin,
    tier,
    verdict: base.verdict,
  }).catch(() => {});

  console.log("====================================");
  console.log("[runScan DEBUG FINAL RESULT]", {
    asin,
    tier,
    isMock: mock,
    isPro,
    verdict: base.verdict,
  });
  console.log("====================================");

  return {
    result: isPro && pro ? pro : base,
    mock,
  };
}
