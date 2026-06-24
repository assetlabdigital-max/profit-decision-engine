import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { upgradeUserToPro } from "@/lib/db/users";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[STRIPE WEBHOOK ERROR]", err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  console.log("[STRIPE WEBHOOK]", event.type);

  if (event.type === "checkout.session.completed") {
    const session: any = event.data.object;

    const userId = session.metadata?.userId;

    console.log("[STRIPE DEBUG] upgrading user =", userId);

    await upgradeUserToPro(userId);
  }

  return NextResponse.json({ ok: true });
}
