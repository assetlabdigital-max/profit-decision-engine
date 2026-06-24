/**
 * STEP 7 FIX + STEP 8 API KEY SaaS LAYER
 * - JWT session tier fallback
 * - Stripe upgrade ready structure
 * - API KEY override support (SaaS mode)
 * - Debug tracing enabled
 * - SAFE fallback guaranteed (no crash)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveTier } from "@/lib/scan/resolve-tier";
import { runScan } from "@/lib/scan/run-scan";
import { validateApiKey } from "@/lib/auth/api-key-auth"; // ⭐ STEP 8 ADD

import type { ApiResponse, ScanResult } from "@/types";

const scanRequestSchema = z.object({
  asin: z.string().trim().min(1).max(32).optional(),
  productUrl: z.string().trim().url().optional(),
  cost: z.number().positive().max(100000).optional(),

  tier: z.enum(["free", "pro"]).optional(),

  debugForcePro: z.boolean().optional(),
});

function jsonError(message: string, code: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code,
      mock: true,
    },
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

    // =========================
    // 🔐 STEP 8 API KEY CHECK
    // =========================
    const apiKey = req.headers.get("x-api-key");

    console.log("====================================");
    console.log("[SCAN DEBUG] apiKey exists =", !!apiKey);
    console.log("====================================");

    const apiUser = await validateApiKey(apiKey ?? undefined);

    console.log("[SCAN DEBUG] apiUser =", apiUser);

    // =========================
    // 🔥 STEP 7 FORCE MODE
    // =========================
    const forcePro = body.debugForcePro === true;

    const resolved = await resolveTier();

    const tier =
      apiUser?.tier ??
      (forcePro ? "pro" : body.tier ? body.tier : resolved.tier);

    console.log("====================================");
    console.log("[STEP7 DEBUG] resolved tier =", resolved.tier);
    console.log("[STEP8 DEBUG] apiKey tier =", apiUser?.tier ?? null);
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
      userId: apiUser?.userId ?? resolved.userId,
    });

    const response: ApiResponse<ScanResult> = {
      ok: true,
      data: result,
      mock,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[SCAN FATAL ERROR]", err);

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
      "POST { asin, cost, tier?, debugForcePro? } with optional x-api-key header → /api/scan",
  });
}
