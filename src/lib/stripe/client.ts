/**
 * src/lib/stripe/client.ts
 *
 * NODE RUNTIME ONLY. Lazily constructs a Stripe client. Construction is
 * wrapped so a missing/invalid key can never throw at import time.
 */

import { isStripeEnabled, getRuntimeConfig } from "@/lib/runtime-config";
import type Stripe from "stripe";

let client: Stripe | null = null;
let initFailed = false;

export function getStripeClient(): Stripe | null {
  if (!isStripeEnabled()) return null;
  if (initFailed) return null;
  if (client) return client;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StripeLib = require("stripe") as typeof Stripe;
    const { stripe } = getRuntimeConfig();
    client = new StripeLib(stripe.secretKey as string, {
      apiVersion: "2024-06-20",
      typescript: true,
    });
    return client;
  } catch (err) {
    console.error("[stripe] failed to initialize client, falling back to mock mode:", err);
    initFailed = true;
    return null;
  }
}
