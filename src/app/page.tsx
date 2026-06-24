"use client";

import { useState } from "react";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        // optional: email 전달 (로그인 시스템 있으면 연결)
        body: JSON.stringify({
          email: null,
        }),
      });

      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Amazon Profit Decision Engine Pro</h1>

      <p>$9.99 / month</p>

      <button
        onClick={handleCheckout}
        disabled={loading}
        style={{
          padding: "12px 20px",
          background: "black",
          color: "white",
          borderRadius: 8,
        }}
      >
        {loading ? "Redirecting..." : "Upgrade to Pro"}
      </button>
    </div>
  );
}
