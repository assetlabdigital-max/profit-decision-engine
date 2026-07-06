"use client";

import { useState } from "react";

interface ScanResult {
  asin: string;
  title: string;
  verdict: "BUY" | "SKIP" | "RISK";
  verdictReason: string;
  price: number;
  rating: number;
  reviewCount: number;
  category: string;
  isMock: boolean;
  eligibility?: "eligible" | "restricted" | "unknown";
  eligibilityReason?: string | null;
  estimatedFees?: {
    referralFee: number;
    fbaFee: number;
    totalFees: number;
  };
  profit?: {
    unitCost: number;
    netProfit: number;
    marginPercent: number;
    roiPercent: number;
  };
  competition?: {
    sellerCount: number;
    buyBoxPrice: number;
    competitionLevel: "low" | "medium" | "high";
  };
}

const VERDICT_COLORS: Record<string, string> = {
  BUY: "#22c55e",
  SKIP: "#f59e0b",
  RISK: "#ef4444",
};

export function ScanPanel({ tier }: { tier: string }) {
  const [asin, setAsin] = useState("");
  const [cost, setCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [mock, setMock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    if (!asin.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asin: asin.trim().toUpperCase(),
          cost: cost ? Number(cost) : undefined,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        setError(json.error ?? "Scan failed");
        return;
      }

      setResult(json.data);
      setMock(json.mock);
    } catch (err) {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          type="text"
          placeholder="ASIN (e.g. B07XJ8C8F7)"
          value={asin}
          onChange={(e) => setAsin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
          style={{
            flex: "2 1 200px",
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #ddd",
            fontSize: 15,
          }}
        />
        <input
          type="number"
          placeholder="Your cost $ (optional)"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          style={{
            flex: "1 1 140px",
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #ddd",
            fontSize: 15,
          }}
        />
        <button
          onClick={handleScan}
          disabled={loading || !asin.trim()}
          style={{
            padding: "10px 20px",
            borderRadius: 6,
            border: "none",
            background: "#111",
            color: "#fff",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            opacity: !asin.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "Scanning..." : "Scan"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#ef4444", fontSize: 14 }}>{error}</p>
      )}

      {result && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, marginTop: 16 }}>

          {/* Verdict Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{
              background: VERDICT_COLORS[result.verdict],
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              padding: "4px 12px",
              borderRadius: 20,
              letterSpacing: "0.05em",
            }}>
              {result.verdict}
            </span>
            {mock && (
              <span style={{ fontSize: 12, color: "#999", background: "#f3f4f6", padding: "3px 8px", borderRadius: 10 }}>
                demo data
              </span>
            )}
          </div>

          {/* Product Info */}
          <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{result.title}</h3>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
            ASIN: {result.asin} · {result.category}
          </p>

          {/* Verdict Reason */}
          <p style={{ margin: "0 0 16px", fontSize: 14, background: "#f9fafb", padding: 12, borderRadius: 6 }}>
            {result.verdictReason}
          </p>

          {/* Basic Stats */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>Price</div>
              <div style={{ fontWeight: 600 }}>${result.price.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>Rating</div>
              <div style={{ fontWeight: 600 }}>{result.rating.toFixed(1)}★</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>Reviews</div>
              <div style={{ fontWeight: 600 }}>{result.reviewCount.toLocaleString()}</div>
            </div>
          </div>

          {/* Eligibility */}
          {result.eligibility && (
            <div style={{ marginBottom: 16, padding: 12, background: "#f9fafb", borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", marginBottom: 4 }}>
                Eligible to Sell
              </div>
              <div style={{
                fontWeight: 600,
                color: result.eligibility === "eligible" ? "#22c55e"
                  : result.eligibility === "restricted" ? "#ef4444"
                  : "#999"
              }}>
                {result.eligibility === "eligible" ? "✅ Yes — you can list this product"
                  : result.eligibility === "restricted" ? "🚫 Restricted — approval required"
                  : "❓ Unknown"}
              </div>
              {result.eligibilityReason && (
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  {result.eligibilityReason}
                </div>
              )}
            </div>
          )}

          {/* Pro Analysis */}
          {tier === "pro" && result.profit && (
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Pro Analysis</div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>Net Profit</div>
                  <div style={{ fontWeight: 600, color: result.profit.netProfit >= 0 ? "#22c55e" : "#ef4444" }}>
                    ${result.profit.netProfit.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>Margin</div>
                  <div style={{ fontWeight: 600 }}>{result.profit.marginPercent.toFixed(1)}%</div>
                </div>
                {result.profit.unitCost > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>ROI</div>
                    <div style={{ fontWeight: 600 }}>{result.profit.roiPercent.toFixed(1)}%</div>
                  </div>
                )}
                {result.estimatedFees && (
                  <div>
                    <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>Total Fees</div>
                    <div style={{ fontWeight: 600 }}>${result.estimatedFees.totalFees.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Free tier upgrade prompt */}
          {tier === "free" && (
            <p style={{ fontSize: 13, color: "#666", borderTop: "1px solid #e5e7eb", paddingTop: 12, margin: 0 }}>
              <a href="/pricing" style={{ color: "#2563eb" }}>Upgrade to Pro</a> for profit, margin, ROI, and fee breakdown.
            </p>
          )}

        </div>
      )}
    </div>
  );
}