"use client";

import { useState } from "react";

export default function Demo() {
  const [asin, setAsin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runScan() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: "Scan failed" });
    } finally {
      setLoading(false);
    }
  }

  function getColor(verdict: string) {
    if (verdict === "BUY") return "#16a34a";
    if (verdict === "SKIP") return "#f59e0b";
    return "#ef4444";
  }

  return (
    <section
      style={{
        padding: 40,
        marginTop: 40,
        borderTop: "1px solid #eee",
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>
        Amazon Profit Decision Scan
      </h2>

      {/* INPUT */}
      <input
        value={asin}
        onChange={(e) => setAsin(e.target.value)}
        placeholder="Enter ASIN (e.g. B08XXXXXX)"
        style={{
          width: "100%",
          padding: 14,
          marginTop: 16,
          border: "1px solid #ddd",
          borderRadius: 10,
          fontSize: 14,
        }}
      />

      {/* BUTTON */}
      <button
        onClick={runScan}
        disabled={!asin || loading}
        style={{
          marginTop: 12,
          padding: "12px 18px",
          background: asin ? "#111" : "#999",
          color: "white",
          borderRadius: 10,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {loading ? "Scanning Amazon..." : "Run Amazon Scan →"}
      </button>

      {/* RESULT */}
      {result && (
        <div
          style={{
            marginTop: 28,
            padding: 20,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fafafa",
          }}
        >
          <h3 style={{ marginBottom: 12 }}>Decision Result</h3>

          {result.error ? (
            <p style={{ color: "red" }}>{result.error}</p>
          ) : (
            <>
              {/* VERDICT BADGE */}
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: getColor(result.data.verdict),
                  color: "white",
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {result.data.verdict}
              </div>

              {/* PRODUCT INFO */}
              <p><b>ASIN:</b> {result.data.asin}</p>
              <p><b>Title:</b> {result.data.title}</p>

              <hr style={{ margin: "12px 0" }} />

              {/* METRICS */}
              <p>💰 Price: ${result.data.price}</p>
              <p>📊 Rating: {result.data.rating}</p>
              <p>⭐ Reviews: {result.data.reviewCount}</p>

              {result.data.verdictReason && (
                <p style={{ marginTop: 10, color: "#666" }}>
                  {result.data.verdictReason}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}