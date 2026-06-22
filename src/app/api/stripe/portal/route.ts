/**
 * src/app/api/stripe/portal/route.ts
 *
 * NODE RUNTIME. Creates a Stripe Billing Portal session so Pro users can
 * manage/cancel their subscription. Falls back to redirecting to the
 * pricing page (with a notice) if Stripe or the customer record is
 * unavailable.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import { getStripeClient } from "@/lib/stripe/client";
import { isStripeEnabled, getRuntimeConfig } from "@/lib/runtime-config";
import { getUserByEmail } from "@/lib/db/users";
import type { ApiResponse } from "@/types";

export async function POST(): Promise<NextResponse> {
  try {
    const session = await auth().catch(() => null);
    const email = session?.user?.email;

    if (!email) {
      const body: ApiResponse<never> = {
        ok: false,
        error: "You must be signed in to manage billing.",
        code: "UNAUTHENTICATED",
      };
      return NextResponse.json(body, { status: 401 });
    }

    const { appUrl } = getRuntimeConfig();

    if (!isStripeEnabled()) {
      const body: ApiResponse<{ url: string }> = {
        ok: true,
        data: { url: `${appUrl}/pricing?portal=unavailable` },
        mock: true,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const client = getStripeClient();
    const { user } = await getUserByEmail(email);

    if (!client || !user.stripeCustomerId) {
      const body: ApiResponse<{ url: string }> = {
        ok: true,
        data: { url: `${appUrl}/pricing?portal=no_customer` },
        mock: true,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const portalSession = await client.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/dashboard`,
    });

    const body: ApiResponse<{ url: string }> = {
      ok: true,
      data: { url: portalSession.url },
      mock: false,
    };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[api/stripe/portal] unhandled error, returning fallback redirect:", err);
    const { appUrl } = getRuntimeConfig();
    const body: ApiResponse<{ url: string }> = {
      ok: true,
      data: { url: `${appUrl}/pricing?portal=error` },
      mock: true,
    };
    return NextResponse.json(body, { status: 200 });
  }
}
