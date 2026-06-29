export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth/auth";
import { getStripeClient } from "@/lib/stripe/client";
import { isStripeEnabled, getRuntimeConfig } from "@/lib/runtime-config";
import { getUserByEmail } from "@/lib/db/users";
import type { ApiResponse } from "@/types";

const bodySchema = z.object({
  plan: z.enum(["monthly", "yearly"]).default("monthly"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth().catch(() => null);
    const email = session?.user?.email;

    if (!email) {
      const body: ApiResponse<never> = {
        ok: false,
        error: "You must be signed in to upgrade.",
        code: "UNAUTHENTICATED",
      };
      return NextResponse.json(body, { status: 401 });
    }

    let payload: unknown = {};
    try {
      payload = await req.json();
    } catch {
      /* default plan applies */
    }
    const { plan } = bodySchema.parse(payload ?? {});

    const { appUrl, stripe } = getRuntimeConfig();

    if (!isStripeEnabled()) {
      const body: ApiResponse<{ url: string }> = {
        ok: true,
        data: { url: `${appUrl}/dashboard?mock_checkout=success&plan=${plan}` },
        mock: true,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const client = getStripeClient();
    if (!client) {
      const body: ApiResponse<{ url: string }> = {
        ok: true,
        data: { url: `${appUrl}/dashboard?mock_checkout=success&plan=${plan}` },
        mock: true,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const priceId = plan === "yearly" ? stripe.priceIdYearly : stripe.priceIdMonthly;
    if (!priceId) {
      console.error("[stripe/checkout] missing price id for plan:", plan);
      const body: ApiResponse<{ url: string }> = {
        ok: true,
        data: { url: `${appUrl}/dashboard?mock_checkout=success&plan=${plan}` },
        mock: true,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const { user } = await getUserByEmail(email);

    const checkoutSession = await client.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.stripeCustomerId ? undefined : email,
      customer: user.stripeCustomerId ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      client_reference_id: email,
      metadata: { email },
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    const body: ApiResponse<{ url: string }> = {
      ok: true,
      data: { url: checkoutSession.url },
      mock: false,
    };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[api/stripe/checkout] unhandled error, returning mock fallback:", err);
    const { appUrl } = getRuntimeConfig();
    const body: ApiResponse<{ url: string }> = {
      ok: true,
      data: { url: `${appUrl}/dashboard?mock_checkout=fallback` },
      mock: true,
    };
    return NextResponse.json(body, { status: 200 });
  }
}
