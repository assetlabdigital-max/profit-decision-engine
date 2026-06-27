import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const priceIdPro = process.env.STRIPE_PRICE_ID_PRO;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3008";

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
    })
  : null;

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is missing." },
        { status: 500 }
      );
    }

    if (!priceIdPro) {
      return NextResponse.json(
        { error: "STRIPE_PRICE_ID_PRO is missing." },
        { status: 500 }
      );
    }

    const { email } = await req.json();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceIdPro,
          quantity: 1,
        },
      ],
      customer_email: email || undefined,
      success_url: `${appUrl}/dashboard?success=1`,
      cancel_url: `${appUrl}/dashboard?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe checkout error]", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}