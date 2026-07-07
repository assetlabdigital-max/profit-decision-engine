export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Retail scans call Apify synchronously (up to ~120s). Vercel must allow it.
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTier } from "@/lib/scan/resolve-tier";
import { runScan } from "@/lib/scan/run-scan";
import { runRetailScan } from "@/lib/scan/run-retail-scan";
import { isRetailUrl } from "@/lib/retail/scraper";
import type { ApiResponse, ScanResult } from "@/types";

const scanRequestSchema = z.object({
  asin: z.string().trim().min(1).max(32).optional(),
  productUrl: z.string().trim().optional(),
  cost: z.number().positive().max(100000).optional(),
});

function jsonError(message: string, code: string, status: number): NextResponse {
  const body: ApiResponse<never> = { ok: false, error: message, code, mock: true };
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const parsed = scanRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError("Invalid request body", "INVALID_INPUT", 400);
    }

    const { tier, userId, usedFallback } = await resolveTier();

    // 소매점 URL이면 retail scan으로 분기
    const inputUrl = parsed.data.productUrl ?? parsed.data.asin ?? "";
    if (inputUrl && isRetailUrl(inputUrl)) {
      const { result, mock, fallbackReason } = await runRetailScan({
        retailUrl: inputUrl,
        cost: parsed.data.cost,
        tier,
        userId,
      });

      const body: ApiResponse<ScanResult> = {
        ok: true,
        data: result,
        mock: mock || usedFallback,
        ...(fallbackReason ? { mockReason: fallbackReason } : {}),
      };
      return NextResponse.json(body, { status: 200 });
    }

    // 기존 ASIN/Amazon URL 스캔
    const { result, mock } = await runScan({
      request: parsed.data,
      tier,
      userId,
    });

    const body: ApiResponse<ScanResult> = {
      ok: true,
      data: result,
      mock: mock || usedFallback,
    };

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[api/scan] unhandled error, returning safe fallback:", err);

    const body: ApiResponse<never> = {
      ok: false,
      error: "Scan temporarily unavailable. Please try again shortly.",
      code: "SCAN_FALLBACK",
      mock: true,
    };
    return NextResponse.json(body, { status: 200 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    message: "POST { asin?: string, productUrl?: string, cost?: number } to this endpoint. Also accepts Costco/Walmart/Target URLs in productUrl.",
  });
}