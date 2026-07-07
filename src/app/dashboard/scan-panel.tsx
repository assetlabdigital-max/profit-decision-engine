"use client";

import { useState } from "react";
import { isRetailUrl, RETAIL_STORE_HINT } from "@/lib/retail/stores";

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
  amazonPriceAvailable?: boolean;
  profitAnalysisReliable?: boolean;
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
  retailArbitrage?: {
    storeName: string;
    storePrice: number;
    storeProductName: string;
    amazonTitle: string;
    matchConfidence: "high" | "medium" | "low";
    matchWarnings?: string[];
    storeBrand?: string | null;
    isStoreExclusiveBrand?: boolean;
    variantMismatch?: boolean;
    titleOverlapScore?: number;
  };
}

const VERDICT_COLORS: Record<string, string> = {
  BUY: "#22c55e",
  SKIP: "#f59e0b",
  RISK: "#ef4444",
};

function isProductUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return (
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.toLowerCase().includes("amazon.com") ||
    isRetailUrl(v)
  );
}

function formatAmazonPrice(price: number, available?: boolean): string {
  if (available === false || price <= 0) return "Unavailable";
  return `$${price.toFixed(2)}`;
}

export function ScanPanel({ tier }: { tier: string }) {
  const [asin, setAsin] = useState("");
  const [cost, setCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [mock, setMock] = useState(false);
  const [mockReason, setMockReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    if (!asin.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setMockReason(null);

    try {
      const input = asin.trim();
      const payload = isProductUrl(input)
        ? { productUrl: input, cost: cost ? Number(cost) : undefined }
        : { asin: input.toUpperCase(), cost: cost ? Number(cost) : undefined };

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.ok) {
        setError(json.error ?? "Scan failed");
        return;
      }

      setResult(json.data);
      setMock(json.mock);
      setMockReason(json.mockReason ?? null);
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
          placeholder={`ASIN or ${RETAIL_STORE_HINT} URL`}
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
          {loading ? (isProductUrl(asin) ? "Scanning store… (up to 2 min)" : "Scanning...") : "Scan"}
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

          {mock && mockReason && (
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#b45309", background: "#fffbeb", padding: 10, borderRadius: 6 }}>
              {mockReason === "retail_scrape_failed"
                ? "Could not read product name/price from the store URL (Apify scrape failed). Try the direct product page URL without extra query parameters."
                : "Found the store product but could not match it on Amazon. Try a more specific product URL or search by ASIN instead."}
            </p>
          )}

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
              <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>Amazon Price</div>
              <div style={{ fontWeight: 600 }}>
                {formatAmazonPrice(result.price, result.amazonPriceAvailable)}
              </div>
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

{result.retailArbitrage && (
  <div style={{
    marginBottom: 16,
    padding: 12,
    background: result.retailArbitrage.matchConfidence === "low" || result.retailArbitrage.variantMismatch ? "#fffbeb" : "#f0fdf4",
    borderRadius: 6,
    border: `1px solid ${result.retailArbitrage.matchConfidence === "low" || result.retailArbitrage.variantMismatch ? "#fde68a" : "#bbf7d0"}`,
  }}>
    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
      🛒 Retail Arbitrage
      {result.retailArbitrage.isStoreExclusiveBrand && (
        <span style={{ marginLeft: 8, fontSize: 11, color: "#b45309", fontWeight: 500 }}>
          Store brand
        </span>
      )}
      {result.retailArbitrage.variantMismatch && (
        <span style={{ marginLeft: 8, fontSize: 11, color: "#b45309", fontWeight: 500 }}>
          Variant mismatch
        </span>
      )}
    </div>
    <p style={{ margin: "0 0 10px", fontSize: 12, color: "#666" }}>
      Store: {result.retailArbitrage.storeProductName}
    </p>
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>{result.retailArbitrage.storeName} Price</div>
        <div style={{ fontWeight: 600, color: "#16a34a" }}>${result.retailArbitrage.storePrice.toFixed(2)}</div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>Amazon Price</div>
        <div style={{ fontWeight: 600 }}>{formatAmazonPrice(result.price, result.amazonPriceAvailable)}</div>
      </div>
      {result.amazonPriceAvailable !== false && result.price > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase" }}>Price Difference</div>
          <div style={{ fontWeight: 600, color: (result.price - result.retailArbitrage.storePrice) > 0 ? "#16a34a" : "#ef4444" }}>
            ${(result.price - result.retailArbitrage.storePrice).toFixed(2)}
          </div>
        </div>
      )}
    </div>
    <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
      Match confidence: {result.retailArbitrage.matchConfidence}
      {result.retailArbitrage.titleOverlapScore != null && (
        <> · Title overlap: {Math.round(result.retailArbitrage.titleOverlapScore * 100)}%</>
      )}
    </div>
    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
      Amazon: &quot;{result.retailArbitrage.amazonTitle.slice(0, 80)}{result.retailArbitrage.amazonTitle.length > 80 ? "…" : ""}&quot;
    </div>
    {result.retailArbitrage.matchWarnings?.map((warning) => (
      <p key={warning} style={{ margin: "8px 0 0", fontSize: 12, color: "#b45309" }}>
        ⚠️ {warning}
      </p>
    ))}
  </div>
)}

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
          {tier === "pro" && result.profit && result.profitAnalysisReliable !== false && (
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

          {tier === "pro" && result.profitAnalysisReliable === false && (
            <p style={{ fontSize: 13, color: "#b45309", borderTop: "1px solid #e5e7eb", paddingTop: 12, margin: 0 }}>
              Pro profit analysis hidden — store brand match or Amazon price is too unreliable for arbitrage math.
            </p>
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