import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = body?.email ?? "test@example.com";

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "missing key" }, { status: 500 });
    }

    if (!process.env.STRIPE_PRICE_ID) {
      return NextResponse.json({ error: "missing price" }, { status: 500 });
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: "missing app url" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,

      customer_email: email,

      metadata: {
        product: "test-mode",
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      id: session.id,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "checkout error",
      },
      { status: 500 }
    );
  }
}
