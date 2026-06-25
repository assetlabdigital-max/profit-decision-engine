import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

// Stripe client (singleton)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
  console.log("=== STRIPE CHECKOUT START ===");

  try {
    // 요청 body 안전 처리
    const body = await req.json().catch(() => ({}));
    const email = body?.email;

    // ENV 검증 (fail-fast)
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!secretKey) {
      console.error("[STRIPE] Missing STRIPE_SECRET_KEY");
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    if (!priceId) {
      console.error("[STRIPE] Missing STRIPE_PRICE_ID");
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_PRICE_ID" },
        { status: 500 }
      );
    }

    if (!appUrl) {
      console.error("[STRIPE] Missing NEXT_PUBLIC_APP_URL");
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_APP_URL" },
        { status: 500 }
      );
    }

    console.log("[STRIPE] email =", email);
    console.log("[STRIPE] priceId =", priceId);

    // Checkout session 생성
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${appUrl}/success`,
      cancel_url: `${appUrl}/cancel`,

      customer_email: email || undefined,

      metadata: {
        product: "profit-decision-engine-pro",
      },
    });

    console.log("[STRIPE] session created:", session.id);

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("=== STRIPE ERROR ===");
    console.error(err);

    return NextResponse.json(
      {
        ok: false,
        error: "checkout_failed",
        message: err?.message ?? "unknown error",
      },
      { status: 500 }
    );
  }
}
