"use client";

import { useSearchParams } from "next/navigation";

export function CheckoutBanner() {
  const params = useSearchParams();
  const checkout = params.get("checkout");
  const mockCheckout = params.get("mock_checkout");
  const plan = params.get("plan");

  if (checkout === "success") {
    return (
      <p
        style={{
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: 8,
          background: "#ecfdf5",
          color: "#166534",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Payment received — your Pro plan activates shortly after Stripe confirms the subscription.
      </p>
    );
  }

  if (mockCheckout === "success") {
    return (
      <p
        style={{
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: 8,
          background: "#fffbeb",
          color: "#92400e",
          fontSize: 14,
        }}
      >
        Mock checkout complete{plan ? ` (${plan})` : ""} — Stripe is not configured in this environment.
      </p>
    );
  }

  if (mockCheckout === "fallback") {
    return (
      <p
        style={{
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: 8,
          background: "#fef2f2",
          color: "#991b1b",
          fontSize: 14,
        }}
      >
        Checkout could not reach Stripe — try again from the pricing page.
      </p>
    );
  }

  return null;
}
