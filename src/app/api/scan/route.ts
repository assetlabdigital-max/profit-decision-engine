/**
 * src/app/api/scan/route.ts
 *
 * NODE RUNTIME. This is the most safety-critical route in the app per
 * project rules: it MUST always return valid JSON, MUST never throw an
 * unhandled error, and MUST degrade to mock data rather than 500.
 *
 * Structure: outer try/catch is the last-resort safety net. Everything
 * it calls (resolveTier, runScan) is already designed to not throw, but
 * we wrap anyway — defense in depth, not trust.
 */

export const runtime = "nodejs";
// Explicit, even though POST already forces dynamic via request.json():
// GET below returns a fixed string with no dynamic inputs, which is
// exactly the shape Next.js will silently static-prerender and freeze
// at build time if this isn't declared. See /api/health/route.ts for
// the incident that surfaced this.
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
      // Empty/invalid JSON body — treat as "no specific product given"
      // rather than failing the whole request.
      payload = {};
    }

    const parsed = scanRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError("Invalid request body", "INVALID_INPUT", 400);
    }

    const { tier, userId, usedFallback } = await resolveTier();

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
    // Last-resort safety net. Even here, we return 200 with a mock
    // payload rather than a 500 — per project rule 9, the user-facing
    // contract is "always JSON, never crash", not "always 200 for
    // success" vs "500 for failure". A 500 page is exactly what we're
    // contractually avoiding.
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
  // Helpful for quick manual testing / uptime checks against this route.
  return NextResponse.json({
    ok: true,
    message: "POST { asin?: string, productUrl?: string, cost?: number } to this endpoint.",
  });
}
