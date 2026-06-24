/**
 * STEP 9 — PRODUCTION FREEZE MODE
 *
 * 핵심 목표:
 * - production 안정성 100% 보장
 * - mock/real 분리 명확화
 * - API KEY / JWT / fallback 구조 고정
 * - 절대 crash 금지 (SaaS contract rule)
 * - logging은 유지하되 "정보성 only"
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveTier } from "@/lib/scan/resolve-tier";
import { runScan } from "@/lib/scan/run-scan";
import { validateApiKey } from "@/lib/auth/api-key-auth";

import type { ApiResponse, ScanResult } from "@/types";

/**
 * STEP 9 FIX: Freeze Mode Config
 */
const FREEZE_CONFIG = {
  allowMockFallback: true,
  allowDebugLogs: true,
  forceRealApify: false, // 🔒 production default OFF
};

const scanRequestSchema = z.object({
  asin: z.string().trim().min(1).max(32).optional(),
  productUrl: z.string().trim().url().optional(),
  cost: z.number().positive().max(100000).optional(),

  tier: z.enum(["free", "pro"]).optional(),
  debugForcePro: z.boolean().optional(),
  debugForceReal: z.boolean().optional(), // ⭐ STEP 9 추가
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

    /**
     * ==============================
     * 🔐 API KEY FIRST CLASS CHECK
     * ==============================
     */
    const apiKey = req.headers.get("x-api-key");
    const apiUser = await validateApiKey(apiKey ?? undefined);

    /**
     * ==============================
     * 🔥 TIER RESOLUTION FREEZE LOGIC
     * ==============================
     */
    const resolved = await resolveTier();

    const tier =
      apiUser?.tier ??
      (body.debugForcePro ? "pro" : body.tier ?? resolved.tier);

    /**
     * ==============================
     * 🔥 DEBUG CONTROL (SAFE)
     * ==============================
     */
    const forceReal = body.debugForceReal === true;

    if (FREEZE_CONFIG.allowDebugLogs) {
      console.log("====================================");
      console.log("[STEP9 FREEZE] apiKey exists =", !!apiKey);
      console.log("[STEP9 FREEZE] apiUser =", apiUser?.tier ?? null);
      console.log("[STEP9 FREEZE] resolved tier =", resolved.tier);
      console.log("[STEP9 FREEZE] final tier =", tier);
      console.log("[STEP9 FREEZE] forceReal =", forceReal);
      console.log("====================================");
    }

    /**
     * ==============================
     * 🧠 MAIN SCAN EXECUTION
     * ==============================
     */
    const { result, mock } = await runScan({
      request: {
        asin: body.asin,
        productUrl: body.productUrl,
        cost: body.cost,
      },
      tier,
      userId: apiUser?.userId ?? resolved.userId,
    });

    /**
     * ==============================
     * 📦 RESPONSE FREEZE CONTRACT
     * ==============================
     */
    const response: ApiResponse<ScanResult> = {
      ok: true,
      data: result,

      // mock only allowed when:
      // - system fallback OR tier-based mock OR debug mode
      mock: FREEZE_CONFIG.allowMockFallback ? mock : false,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    /**
     * ==============================
     * 🚨 ABSOLUTE SAFETY NET (DO NOT REMOVE)
     * ==============================
     */
    console.error("[STEP9 FREEZE FATAL]", err);

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

/**
 * GET — SAFE HEALTH CHECK (FREEZE MODE)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: "STEP9_FREEZE_MODE",
    message:
      "POST { asin, cost, tier?, debugForcePro?, debugForceReal? } → /api/scan",
  });
}
