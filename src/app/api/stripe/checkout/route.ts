/**
 * STEP 10 — STRIPE CHECKOUT API (PRO PLAN)
 * - Creates Stripe subscription checkout session
 * - Uses PRICE_ID from .env.local
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = body.email ?? undefined;

    console.log("====================================");
    console.log("[STRIPE CHECKOUT] request email =", email);
    console.log("====================================");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      line_items: [
        {
          price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],

      // 🔥 user email 연결 (optional but recommended)
      customer_email: email,

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,

      metadata: {
        source: "profit-decision-engine",
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (err) {
    console.error("[STRIPE CHECKOUT ERROR]", err);

    return NextResponse.json(
      {
        ok: false,
        error: "CHECKOUT_FAILED",
      },
      { status: 500 }
    );
  }
}
