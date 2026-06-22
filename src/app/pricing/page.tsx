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

      if (json?.data?.url) {
        window.location.href = json.data.url;
      } else {
        alert("Checkout session failed. Please try again.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  async function manageBilling() {
    setLoading("portal");

    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const json = await res.json();

      if (json?.data?.url) {
        window.location.href = json.data.url;
      } else {
        alert("Unable to open billing portal.");
      }
    } catch (err) {
      console.error("Portal error:", err);
      alert("Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "80px auto",
        padding: "0 24px",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 10 }}>Pricing</h1>

      <p style={{ color: "#666", marginBottom: 30 }}>
        Simple pricing. Start free. Upgrade when you need full profit intelligence.
      </p>

      <section style={{ display: "flex", gap: 24 }}>
        {/* FREE */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 20,
            flex: 1,
          }}
        >
          <h2>Free</h2>
          <p>✔ Basic verdict (BUY / SKIP / RISK)</p>
          <p>✔ Mock product data</p>
          <p>✖ Profit breakdown locked</p>

          <button
            disabled
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "#eee",
              borderRadius: 8,
              cursor: "not-allowed",
            }}
          >
            Current Plan
          </button>
        </div>

        {/* PRO */}
        <div
          style={{
            border: "2px solid black",
            borderRadius: 10,
            padding: 20,
            flex: 1,
          }}
        >
          <h2>Pro</h2>

          <p>✔ Real Amazon data</p>
          <p>✔ Margin & ROI</p>
          <p>✔ Fee breakdown</p>
          <p>✔ Competition score</p>

          <button
            disabled={loading !== null}
            onClick={() => upgrade("monthly")}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "12px",
              background: "black",
              color: "white",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            {loading === "checkout" ? "Redirecting..." : "Upgrade — Monthly"}
          </button>

          <button
            disabled={loading !== null}
            onClick={() => upgrade("yearly")}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "12px",
              background: "#222",
              color: "white",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            Upgrade — Yearly
          </button>
        </div>
      </section>

      {/* Billing */}
      <div style={{ marginTop: 40 }}>
        <button
          disabled={loading !== null}
          onClick={manageBilling}
          style={{
            padding: "10px 14px",
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          {loading === "portal"
            ? "Opening..."
            : "Manage existing subscription"}
        </button>
      </div>
    </main>
  );
}