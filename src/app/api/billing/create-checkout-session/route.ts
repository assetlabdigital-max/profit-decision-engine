export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";

export async function POST() {
  try {
    const session =
      await stripe.checkout.sessions.create({
        mode: "subscription",

        line_items: [
          {
            price:
              process.env
                .NEXT_PUBLIC_STRIPE_PRICE_ID!,
            quantity: 1,
          },
        ],

        success_url:
          "https://profit-decision-engine.vercel.app/dashboard?success=true",

        cancel_url:
          "https://profit-decision-engine.vercel.app/pricing",
      });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        ok: false,
        error: "CHECKOUT_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
