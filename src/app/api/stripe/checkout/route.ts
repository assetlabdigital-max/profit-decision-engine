import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
console.log("====================================");
console.log("=== STRIPE CHECKOUT ROUTE HIT ===");
console.log("====================================");

try {
const body = await req.json().catch(() => ({}));

```
const email = body?.email;

console.log("[CHECKOUT DEBUG] email =", email);
console.log("[CHECKOUT DEBUG] PRICE_ID =", process.env.STRIPE_PRICE_ID);
console.log("[CHECKOUT DEBUG] APP_URL =", process.env.NEXT_PUBLIC_APP_URL);

if (!process.env.STRIPE_SECRET_KEY) {
  return NextResponse.json(
    {
      ok: false,
      error: "Missing STRIPE_SECRET_KEY",
    },
    { status: 500 }
  );
}

if (!process.env.STRIPE_PRICE_ID) {
  return NextResponse.json(
    {
      ok: false,
      error: "Missing STRIPE_PRICE_ID",
    },
    { status: 500 }
  );
}

if (!process.env.NEXT_PUBLIC_APP_URL) {
  return NextResponse.json(
    {
      ok: false,
      error: "Missing NEXT_PUBLIC_APP_URL",
    },
    { status: 500 }
  );
}

const session = await stripe.checkout.sessions.create({
  payment_method_types: ["card"],

  mode: "subscription",

  line_items: [
    {
      price: process.env.STRIPE_PRICE_ID,
      quantity: 1,
    },
  ],

  customer_email: email || undefined,

  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,

  metadata: {
    product: "profit-decision-engine-pro",
  },
});

console.log(
  "[STRIPE CHECKOUT SUCCESS] session id =",
  session.id
);

return NextResponse.json({
  ok: true,
  url: session.url,
  sessionId: session.id,
});
```

} catch (err: any) {
console.log("====================================");
console.log("=== STRIPE FULL ERROR ===");
console.log("====================================");

```
console.error(err);
console.error("message =", err?.message);
console.error("type =", err?.type);
console.error("code =", err?.code);
console.error("statusCode =", err?.statusCode);

return NextResponse.json(
  {
    ok: false,
    error: "checkout_failed",
    message: err?.message ?? "unknown error",
  },
  { status: 500 }
);
```

}
}
