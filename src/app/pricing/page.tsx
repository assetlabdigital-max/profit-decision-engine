"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/app/components/nav";
import { Eyebrow } from "@/app/components/ui";
import { Footer } from "@/app/components/cta-footer";

const FREE_FEATURES = [
  "ASIN verdicts (BUY / SKIP / RISK)",
  "Live Amazon price, rating & reviews",
  "Category & listing snapshot",
];

const PRO_FEATURES = [
  "Full margin, FBA fees & ROI breakdown",
  "Competition & buy-box context",
  "Risk flags when margin or match is unreliable",
  "Retail store URL scan (beta, login required)",
];

export default function PricingPage() {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  const cancelled = params.get("checkout") === "cancelled";

  async function upgrade() {
    setLoading("checkout");
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "monthly" }),
      });
      const json = await res.json();
      if (res.status === 401) {
        window.location.href = "/login?next=/pricing";
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
      if (res.status === 401) {
        window.location.href = "/login?next=/pricing";
        return;
      }
      if (json?.data?.url) window.location.href = json.data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <Nav />
      <main style={{ padding: "80px 0 100px" }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <Eyebrow>Pricing</Eyebrow>
          <h1
            className="font-display"
            style={{ fontSize: "clamp(32px, 4vw, 44px)", fontWeight: 700, margin: "12px 0 14px" }}
          >
            Simple plans for Amazon sellers
          </h1>
          <p style={{ color: "var(--paper-dim)", maxWidth: 520, marginBottom: 40 }}>
            Start free with ASIN verdicts. Upgrade when you need full profit math and Pro risk signals.
          </p>

          {cancelled && (
            <p
              style={{
                color: "#fbbf24",
                background: "rgba(251,191,36,0.1)",
                padding: 14,
                borderRadius: "var(--radius-sm)",
                marginBottom: 24,
              }}
            >
              Checkout was cancelled — no charge was made.
            </p>
          )}

          {error && (
            <p
              style={{
                color: "var(--risk)",
                background: "rgba(248,113,113,0.1)",
                padding: 14,
                borderRadius: "var(--radius-sm)",
                marginBottom: 24,
              }}
            >
              {error}
            </p>
          )}

          <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div
              style={{
                border: "1px solid var(--ink-line)",
                borderRadius: "var(--radius-md)",
                padding: 28,
                background: "var(--ink-1)",
              }}
            >
              <h2 className="font-display" style={{ fontSize: 22, margin: "0 0 8px" }}>
                Free
              </h2>
              <p style={{ color: "var(--paper-dim)", margin: "0 0 20px" }}>For quick sourcing checks.</p>
              <div className="font-display" style={{ fontSize: 36, fontWeight: 700, marginBottom: 20 }}>
                $0
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", color: "var(--paper-dim)", fontSize: 14 }}>
                {FREE_FEATURES.map((f) => (
                  <li key={f} style={{ marginBottom: 10 }}>
                    ✓ {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "13px 20px",
                  border: "1px solid var(--ink-line)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--paper)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Get started free
              </Link>
            </div>

            <div
              style={{
                border: "1px solid var(--accent)",
                borderRadius: "var(--radius-md)",
                padding: 28,
                background: "var(--ink-1)",
                position: "relative",
              }}
            >
              <span
                className="font-mono"
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  fontSize: 11,
                  color: "var(--accent-bright)",
                  letterSpacing: "0.06em",
                }}
              >
                RECOMMENDED
              </span>
              <h2 className="font-display" style={{ fontSize: 22, margin: "0 0 8px" }}>
                Pro
              </h2>
              <p style={{ color: "var(--paper-dim)", margin: "0 0 20px" }}>Full profit breakdown for serious sellers.</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
                <span className="font-display" style={{ fontSize: 40, fontWeight: 700 }}>
                  $9.99
                </span>
                <span style={{ color: "var(--paper-dim)", fontSize: 14 }}>/ month</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", color: "var(--paper-dim)", fontSize: 14 }}>
                {PRO_FEATURES.map((f) => (
                  <li key={f} style={{ marginBottom: 10 }}>
                    ✓ {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={loading !== null}
                onClick={upgrade}
                style={{
                  width: "100%",
                  padding: "13px 20px",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: 600,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading === "checkout" ? "Redirecting to Stripe…" : "Upgrade to Pro"}
              </button>
            </div>
          </div>

          <p style={{ marginTop: 32, fontSize: 14, color: "var(--paper-faint)" }}>
            Already subscribed?{" "}
            <button
              type="button"
              disabled={loading !== null}
              onClick={manageBilling}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent-bright)",
                cursor: "pointer",
                padding: 0,
                font: "inherit",
                textDecoration: "underline",
              }}
            >
              {loading === "portal" ? "Opening portal…" : "Manage billing"}
            </button>
          </p>

          <p style={{ marginTop: 16, fontSize: 13, color: "var(--paper-faint)" }}>
            Retail arbitrage scans are in beta while live store data is validated. ASIN analysis is launch-ready.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
