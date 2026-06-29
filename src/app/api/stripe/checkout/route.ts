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
    // 🔐 AUTH CHECK
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

    // 📦 SAFE PAYLOAD PARSE
    let payload: unknown = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const parsed = bodySchema.safeParse(payload);

    if (!parsed.success) {
      const body: ApiResponse<never> = {
        ok: false,
        error: "Invalid request body",
        code: "INVALID_INPUT",
      };
      return NextResponse.json(body, { status: 400 });
    }

    const { plan } = parsed.data;

    const { appUrl, stripe } = getRuntimeConfig();

    // 🔥 MOCK MODE (Stripe disabled)
    if (!isStripeEnabled()) {
      console.warn("[stripe/checkout] running in MOCK mode");

      const body: ApiResponse<{ url: string }> = {
        ok: true,
        data: {
          url: `${appUrl}/dashboard?mock_checkout=success&plan=${plan}`,
        },
        mock: true,
      };

      return NextResponse.json(body, { status: 200 });
    }

    const client = getStripeClient();

    // 🔥 NO STRIPE CLIENT
    if (!client) {
      console.warn("[stripe/checkout] missing Stripe client");

      const body: ApiResponse<{ url: string }> = {
        ok: true,
        data: {
          url: `${appUrl}/dashboard?mock_checkout=success&plan=${plan}`,
        },
        mock: true,
      };

      return NextResponse.json(body, { status: 200 });
    }

    // 💳 PRICE RESOLUTION
    const priceId =
      plan === "yearly" ? stripe.priceIdYearly : stripe.priceIdMonthly;

    if (!priceId) {
      console.error("[stripe/checkout] missing priceId:", plan);

      const body: ApiResponse<{ url: string }> = {
        ok: true,
        data: {
          url: `${appUrl}/dashboard?mock_checkout=missing_price`,
        },
        mock: true,
      };

      return NextResponse.json(body, { status: 200 });
    }

    // 👤 USER LOOKUP
    const { user } = await getUserByEmail(email);

    // 🚀 CREATE CHECKOUT SESSION
    const checkoutSession = await client.checkout.sessions.create({
      mode: "subscription",

      customer_email: user.stripeCustomerId ? undefined : email,
      customer: user.stripeCustomerId ?? undefined,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,

      client_reference_id: email,
      metadata: {
        email,
        plan,
      },
    });

    // 🚨 URL SAFETY CHECK
    if (!checkoutSession?.url) {
      console.error("[stripe/checkout] missing checkout URL");

      throw new Error("Stripe did not return checkout URL");
    }

    // ✅ SUCCESS RESPONSE
    const body: ApiResponse<{ url: string }> = {
      ok: true,
      data: {
        url: checkoutSession.url,
      },
      mock: false,
    };

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[stripe/checkout] fatal error fallback:", err);

    const { appUrl } = getRuntimeConfig();

    const body: ApiResponse<{ url: string }> = {
      ok: true,
      data: {
        url: `${appUrl}/dashboard?mock_checkout=fallback`,
      },
      mock: true,
    };

    return NextResponse.json(body, { status: 200 });
  }
}