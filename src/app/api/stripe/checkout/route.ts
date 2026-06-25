import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = body?.email;

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[STRIPE ERROR] Missing STRIPE_SECRET_KEY");

      return NextResponse.json(
        {
          ok: false,
          error: "Stripe secret key missing",
          code: "STRIPE_CONFIG_ERROR",
        },
        { status: 500 }
      );
    }

    if (!process.env.STRIPE_PRICE_ID) {
      console.error("[STRIPE ERROR] Missing STRIPE_PRICE_ID");

      return NextResponse.json(
        {
          ok: false,
          error: "Stripe price id missing",
          code: "STRIPE_PRICE_MISSING",
        },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,

      // SaaS 핵심: email 기반 고객 식별
      customer_email: email || undefined,

      // 중요: 추적용 metadata
      metadata: {
        product: "profit-decision-engine-pro",
      },
    });

    console.log("[STRIPE CHECKOUT] session created =", session.id);

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("[STRIPE CHECKOUT ERROR]", err);

    return NextResponse.json(
      {
        ok: false,
        error: "checkout_failed",
        code: "STRIPE_CHECKOUT_ERROR",
        message: err?.message ?? "unknown error",
      },
      { status: 500 }
    );
  }
}
