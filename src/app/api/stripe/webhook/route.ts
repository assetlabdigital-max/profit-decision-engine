import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { upgradeUserToPro } from "@/lib/db/upgrade";

export const runtime = "nodejs";

const stripe = new Stripe(getRuntimeConfig().stripe.secretKey!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: Request) {
  console.log("========== WEBHOOK HIT ==========");

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      webhookSecret
    );

    console.log("EVENT TYPE:", event.type);

  } catch (err) {
    console.error("[stripe signature error]", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    try {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("SESSION:");
      console.dir(session, { depth: null });

      // ✅ customer_email이 없으면 customer_details.email 사용
      const email =
        session.customer_email ??
        session.customer_details?.email ??
        null;

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : "";

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : "";

      if (!email) {
        console.error("No email found in checkout session");
        return NextResponse.json({ received: true });
      }

      console.log("[stripe webhook] payment success:", email);

      const result = await upgradeUserToPro({
        email,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });

      console.log("upgradeUserToPro result:");
      console.dir(result, { depth: null });

      if (result.ok) {
        console.log(`[DB] ${email} upgraded to PRO`);
      } else {
        console.error(`[DB] upgrade failed for ${email}`);
      }

    } catch (err) {
      console.error("[webhook runtime error]");
      console.error(err);
    }
  }

  return NextResponse.json({ received: true });
}