/**
 * STEP 7 FIX — REAL APIFY FORCE MODE + DEBUG TRACE + MOCK SAFETY CONTROL
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTier } from "@/lib/scan/resolve-tier";
import { runScan } from "@/lib/scan/run-scan";
import type { ApiResponse, ScanResult } from "@/types";

const scanRequestSchema = z.object({
  asin: z.string().trim().min(1).max(32).optional(),
  productUrl: z.string().trim().url().optional(),
  cost: z.number().positive().max(100000).optional(),
  tier: z.enum(["free", "pro"]).optional(),
  debugForcePro: z.boolean().optional(), // ⭐ STEP 7 FIX 핵심
});

function jsonError(message: string, code: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message, code, mock: true },
    { status }
  );
}

export async function POST(req: NextRequest) {
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

    const body = parsed.data;

    // 🔥 STEP 7 FIX: FORCE PRO OVERRIDE (test mode)
    const forcePro = body.debugForcePro === true;

    const resolved = await resolveTier();

    const tier =
      forcePro
        ? "pro"
        : body.tier
        ? body.tier
        : resolved.tier;

    console.log("====================================");
    console.log("[STEP7 DEBUG] resolved tier =", resolved.tier);
    console.log("[STEP7 DEBUG] final tier =", tier);
    console.log("[STEP7 DEBUG] forcePro =", forcePro);
    console.log("====================================");

    const { result, mock } = await runScan({
      request: {
        asin: body.asin,
        productUrl: body.productUrl,
        cost: body.cost,
      },
      tier,
      userId: resolved.userId,
    });

    const response: ApiResponse<ScanResult> = {
      ok: true,
      data: result,
      mock,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[STEP7 API ERROR]", err);

    return NextResponse.json(
      {
        ok: false,
        error: "SCAN_FALLBACK",
        code: "SCAN_FALLBACK",
        mock: true,
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "POST { asin, cost, tier?, debugForcePro? } → /api/scan",
  });
}
