/**
 * src/app/api/stripe/webhook/route.ts
 *
 * STEP 10 — Stripe Monetization Engine (PRODUCTION VERSION)
 * - Handles checkout.session.completed
 * - Upgrades user to PRO
 * - Safe fallback + full logging
 * - Email-based user mapping
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db/prisma"; // ⚠️ 너 프로젝트에 맞게 경로 확인

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    console.error("[STRIPE WEBHOOK] Missing signature");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[STRIPE WEBHOOK] Signature verification failed:", err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  console.log("====================================");
  console.log("[STRIPE WEBHOOK] event type =", event.type);
  console.log("====================================");

  try {
    // ================================
    // 🎯 PAYMENT SUCCESS EVENT
    // ================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("[STRIPE WEBHOOK] FULL SESSION =", session);

      const email =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      console.log("[STRIPE WEBHOOK] customer email =", email);

      if (!email) {
        console.warn("[STRIPE WEBHOOK] No email found — skipping upgrade");
        return NextResponse.json({ ok: true });
      }

      console.log("[STRIPE WEBHOOK] upgrading user to PRO...");

      // ================================
      // 🔥 CORE UPGRADE LOGIC
      // ================================
      const updatedUser = await prisma.user.update({
        where: {
          email: email,
        },
        data: {
          tier: "pro",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        },
      });

      console.log("[STRIPE WEBHOOK] USER UPGRADED =", updatedUser.email);
    }

    // ================================
    // 🎯 OPTIONAL: SUBSCRIPTION CANCELED
    // ================================
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      console.log("[STRIPE WEBHOOK] subscription canceled =", subscription.id);

      const customer = await stripe.customers.retrieve(
        subscription.customer as string
      );

      if (!customer || customer.deleted) return;

      const email = (customer as Stripe.Customer).email;

      if (email) {
        await prisma.user.update({
          where: { email },
          data: {
            tier: "free",
            stripeSubscriptionId: null,
          },
        });

        console.log("[STRIPE WEBHOOK] USER DOWNGRADED TO FREE =", email);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[STRIPE WEBHOOK ERROR]", err);

    return NextResponse.json(
      {
        ok: false,
        error: "WEBHOOK_PROCESSING_FAILED",
      },
      { status: 500 }
    );
  }
}

// ================================
// Stripe requires raw endpoint
// ================================
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Stripe webhook endpoint is active",
  });
}
