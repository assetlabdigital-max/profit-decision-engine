"use client";

import Link from "next/link";
import { useState } from "react";
import { Eyebrow } from "@/app/components/ui";

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
    } catch {
      setResult({ error: "Scan failed" });
    } finally {
      setLoading(false);
    }
  }

  function verdictClass(verdict: string) {
    if (verdict === "BUY") return "verdict verdict--buy";
    return "verdict";
  }

  return (
    <section id="demo" style={{ padding: "96px 0", borderTop: "1px solid var(--ink-line)" }}>
      <div className="wrap" style={{ maxWidth: 720 }}>
        <Eyebrow>Live demo</Eyebrow>
        <h2
          className="font-display"
          style={{ fontSize: "clamp(26px, 3vw, 34px)", fontWeight: 700, margin: "12px 0 10px" }}
        >
          Try an ASIN — no sign-in required
        </h2>
        <p style={{ color: "var(--paper-dim)", margin: "0 0 28px", fontSize: 16 }}>
          Free verdict on the homepage. Sign in for full margin, fees, and Pro breakdowns.
        </p>

        <input
          value={asin}
          onChange={(e) => setAsin(e.target.value)}
          placeholder="Enter ASIN (e.g. B08N5WRWNW)"
          style={{
            width: "100%",
            padding: "14px 16px",
            border: "1px solid var(--ink-line)",
            borderRadius: "var(--radius-sm)",
            fontSize: 15,
            background: "var(--ink-1)",
            color: "var(--paper)",
          }}
        />

        <button
          onClick={runScan}
          disabled={!asin || loading}
          style={{
            marginTop: 12,
            padding: "13px 22px",
            background: asin ? "var(--accent)" : "var(--ink-2)",
            color: "var(--paper)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            cursor: asin && !loading ? "pointer" : "not-allowed",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Scanning Amazon…" : "Run Amazon scan →"}
        </button>

        {result && (
          <div
            style={{
              marginTop: 28,
              padding: 22,
              border: "1px solid var(--ink-line)",
              borderRadius: "var(--radius-md)",
              background: "var(--ink-1)",
            }}
          >
            {result.error ? (
              <p style={{ color: "var(--risk)", margin: 0 }}>{result.error}</p>
            ) : (
              <>
                <span
                  className={verdictClass(result.data.verdict)}
                  style={
                    result.data.verdict === "SKIP"
                      ? { background: "rgba(248,113,113,0.15)", color: "var(--risk)" }
                      : result.data.verdict === "RISK"
                        ? { background: "rgba(251,191,36,0.15)", color: "#fbbf24" }
                        : undefined
                  }
                >
                  {result.data.verdict}
                </span>

                <p style={{ margin: "14px 0 6px", fontWeight: 600 }}>{result.data.title}</p>
                <p className="font-mono" style={{ fontSize: 13, color: "var(--paper-dim)", margin: "0 0 12px" }}>
                  {result.data.asin}
                </p>

                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, color: "var(--paper-dim)" }}>
                  <span>Price: ${result.data.price}</span>
                  <span>Rating: {result.data.rating}</span>
                  <span>Reviews: {result.data.reviewCount}</span>
                </div>

                {result.data.verdictReason && (
                  <p style={{ marginTop: 14, color: "var(--paper-dim)", fontSize: 14 }}>
                    {result.data.verdictReason}
                  </p>
                )}

                <p style={{ marginTop: 18, fontSize: 14 }}>
                  Want margin, FBA fees, and ROI?{" "}
                  <Link href="/login" style={{ color: "var(--accent-bright)" }}>
                    Sign in free → upgrade to Pro ($9.99/mo)
                  </Link>
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
