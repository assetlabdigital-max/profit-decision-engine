"use client";

import { useState } from "react";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@example.com", // 로그인 시스템 있으면 교체
      }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    }

    setLoading(false);
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
        {loading ? "Loading..." : "Upgrade to Pro"}
      </button>
    </div>
  );
}
