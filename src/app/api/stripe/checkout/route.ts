import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { auth } from "@/auth/auth";
import { getUserByEmail } from "@/lib/db/users";
import { getRuntimeConfig, isStripeEnabled } from "@/lib/runtime-config";
import { getStripeClient } from "@/lib/stripe/client";

export const runtime = "nodejs";

// Stripe client (fallback-safe)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  console.log("====================================");
  console.log("=== STRIPE CHECKOUT (SAAS MODE) ===");
  console.log("====================================");

  try {
    // 1️⃣ AUTH CHECK (SaaS 핵심)
    const session = await auth().catch(() => null);
    const email = session?.user?.email;

    // fallback (테스트용 안전장치)
    let requestEmail = email;

    const body = await req.json().catch(() => ({}));
    if (!requestEmail) {
      requestEmail = body?.email ?? null;
    }

    if (!requestEmail) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTHENTICATED",
          code: "UNAUTHENTICATED",
        },
        { status: 401 }
      );
    }

    // 2️⃣ ENV CHECK
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    if (!process.env.STRIPE_PRICE_ID) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_PRICE_ID" },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_APP_URL" },
        { status: 500 }
      );
    }

    // 3️⃣ STRIPE CLIENT (fallback safe)
    const client = getStripeClient() || stripe;

    // 4️⃣ CREATE CHECKOUT SESSION
    const checkoutSession = await client.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],

      customer_email: requestEmail,

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,

      metadata: {
        product: "profit-decision-engine-pro",
        email: requestEmail,
      },
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return checkout URL");
    }

    console.log("[STRIPE SUCCESS] session =", checkoutSession.id);

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (err: any) {
    console.error("====================================");
    console.error("=== STRIPE CHECKOUT ERROR ===");
    console.error("====================================");

    console.error(err?.message);
    console.error(err);

    const { appUrl } = getRuntimeConfig();

    return NextResponse.json(
      {
        ok: false,
        error: "checkout_failed",
        message: err?.message ?? "unknown error",
        fallback: `${appUrl}/dashboard`,
      },
      { status: 500 }
    );
  }
}
