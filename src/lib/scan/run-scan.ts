/**
 * src/lib/scan/run-scan.ts
 *
 * NODE RUNTIME. Pure(ish) business logic for the scan engine, kept
 * separate from the route handler so it can be unit-tested and so the
 * route handler's job is purely "catch everything, always return JSON".
 *
 * Every code path here returns a value — none of them throw on
 * "expected" failure modes (bad input, DB down). The route handler still
 * wraps this in try/catch as a last-resort safety net per project rules,
 * but this function is designed to never need it.
 */

import type { ScanRequest, ScanResultBase, ScanResultPro, Tier } from "@/types";
import { buildMockScanBase, buildMockScanPro } from "@/lib/mock/mock-data";
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
  if (req.asin && req.asin.trim()) return req.asin.trim().toUpperCase();

  if (req.productUrl) {
    // Best-effort ASIN extraction from a standard Amazon URL pattern.
    const match = req.productUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (match) return match[1].toUpperCase();
  }

  return "UNKNOWN";
}

/**
 * Runs a scan and returns tier-appropriate data.
 *
 * Real product-data lookup (e.g. a future Amazon SP-API / scraping
 * integration) would be attempted here, wrapped in its own try/catch,
 * with a fallback to buildMockScanBase/Pro on any failure — exactly the
 * same fallback shape as the DB/Stripe/Email layers, so the whole app
 * has one consistent failure-handling pattern.
 */
export async function runScan({ request, tier, userId }: RunScanParams): Promise<RunScanResult> {
  const asin = extractAsin(request);

  let mock = true;
  let base: ScanResultBase;
  let pro: ScanResultPro | null = null;

  try {
    // Placeholder for a real external product-data lookup.
    // No live provider is wired up yet, so we deterministically mock —
    // this is NOT an error path, it's the current real behavior.
    base = buildMockScanBase(asin);
    if (tier === "pro") {
      pro = buildMockScanPro(asin, request.cost);
    }
  } catch (err) {
    // Defensive: even if the mock generator somehow threw (e.g. bad
    // input causing a NaN cascade), fall back to the safest possible
    // static response rather than letting the error escape.
    console.error("[scan] mock generation failed unexpectedly, using static fallback:", err);
    base = {
      asin: asin || "UNKNOWN",
      title: "Scan temporarily unavailable",
      verdict: "RISK",
      verdictReason: "Unable to generate a result right now. Please try again.",
      price: 0,
      rating: 0,
      reviewCount: 0,
      category: "Unknown",
      isMock: true,
      generatedAt: new Date().toISOString(),
    };
    mock = true;
  }

  // Best-effort analytics write. MUST NOT affect the response we return.
  void recordScan({ userId, asin, tier, verdict: base.verdict }).catch((err) => {
    console.error("[scan] recordScan failed (non-fatal, ignored):", err);
  });

  return {
    result: tier === "pro" && pro ? pro : base,
    mock,
  };
}