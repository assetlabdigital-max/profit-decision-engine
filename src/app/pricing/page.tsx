"use client";

import { useState } from "react";

export default function PricingPage() {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);

  async function upgrade(plan: "monthly" | "yearly") {
    setLoading("checkout");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json?.data?.url) window.location.href = json.data.url;
    } finally {
      setLoading(null);
    }
  }

  async function manageBilling() {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();
      if (json?.data?.url) window.location.href = json.data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
      <h1>Pricing</h1>

      <section style={{ display: "flex", gap: 24, marginTop: 24 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20, flex: 1 }}>
          <h2>Free</h2>
          <p>Verdict + basic listing info.</p>
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20, flex: 1 }}>
          <h2>Pro</h2>
          <p>Full profit, fees, margin, and competition breakdown.</p>
          <button disabled={loading !== null} onClick={() => upgrade("monthly")}>
            {loading === "checkout" ? "Redirecting..." : "Upgrade — Monthly"}
          </button>
          <button disabled={loading !== null} onClick={() => upgrade("yearly")} style={{ marginLeft: 8 }}>
            Upgrade — Yearly
          </button>
        </div>
      </section>

      <p style={{ marginTop: 24 }}>
        <button disabled={loading !== null} onClick={manageBilling}>
          {loading === "portal" ? "Redirecting..." : "Manage existing subscription"}
        </button>
      </p>
    </main>
  );
}
