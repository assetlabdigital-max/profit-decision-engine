"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PricingPage() {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  const cancelled = params.get("checkout") === "cancelled";

  async function upgrade(plan: "monthly" | "yearly") {
    setLoading("checkout");
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setError(json.error || "Checkout failed.");
        return;
      }
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

      {cancelled && (
        <p style={{ color: "#92400e", background: "#fffbeb", padding: 12, borderRadius: 8 }}>
          Checkout was cancelled — no charge was made.
        </p>
      )}

      {error && (
        <p style={{ color: "#991b1b", background: "#fef2f2", padding: 12, borderRadius: 8 }}>
          {error}
        </p>
      )}

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
