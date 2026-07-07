export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { tryClaimStripeEvent, upgradeUserToPro, getUserByStripeCustomerId, upsertStripeSubscription } from "@/lib/db/users";

const stripe = new Stripe(getRuntimeConfig().stripe.secretKey!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[stripe/webhook] Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[stripe/webhook] event type:", event.type, "id:", event.id);

  const claim = await tryClaimStripeEvent(event.id);
  if (!claim.mock && !claim.claimed) {
    console.log(`[stripe/webhook] duplicate event ${event.id}, skipping`);
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claim.mock) {
    console.warn(
      `[stripe/webhook] DB unavailable — cannot dedupe event ${event.id}, processing best-effort`
    );
  }

  if (event.type === "checkout.session.completed") {
    try {
      const session = event.data.object as Stripe.Checkout.Session;

      const email = session.customer_email ?? session.customer_details?.email ?? null;
      const customerId = typeof session.customer === "string" ? session.customer : "";
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : "";

      if (!email) {
        console.error("[stripe/webhook] no email found in checkout session");
        return NextResponse.json({ received: true });
      }

      const result = await upgradeUserToPro({
        email,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId || null,
      });

      if (result.ok) {
        console.log(`[stripe/webhook] ${email} upgraded to PRO`);
      } else {
        console.error(`[stripe/webhook] upgrade failed for ${email}`);
      }
    } catch (err) {
      console.error("[stripe/webhook] runtime error:", err);
    }
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    try {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? "";

      if (!customerId) {
        console.error("[stripe/webhook] subscription event missing customer id");
        return NextResponse.json({ received: true });
      }

      const { user } = await getUserByStripeCustomerId(customerId);
      if (!user) {
        console.warn(`[stripe/webhook] no user for Stripe customer ${customerId}`);
        return NextResponse.json({ received: true });
      }

      const activeStatuses = new Set(["active", "trialing"]);
      const tier = activeStatuses.has(subscription.status) ? "pro" : "free";

      const result = await upsertStripeSubscription({
        email: user.email,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        tier,
      });

      if (result.ok) {
        console.log(
          `[stripe/webhook] ${user.email} subscription ${subscription.status} → tier=${tier}`
        );
      }
    } catch (err) {
      console.error("[stripe/webhook] subscription lifecycle error:", err);
    }
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Stripe webhook endpoint is active" });
}
