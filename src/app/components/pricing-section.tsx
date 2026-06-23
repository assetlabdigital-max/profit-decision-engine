import { Eyebrow } from "@/app/components/ui";

const FREE_FEATURES = [
  "Unlimited verdicts (BUY/SKIP/RISK)",
  "Price, rating & review count",
  "Category & listing snapshot",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Full margin, fee & ROI breakdown",
  "Competition & buy-box analysis",
  "Review-trend risk detection",
  "Priority scan processing",
];

export default function PricingSection() {
  return (
    <section style={{ padding: "96px 0", borderTop: "1px solid var(--ink-line)" }}>
      <div className="wrap">
        <div style={{ maxWidth: 560, marginBottom: 48 }}>
          <Eyebrow>Pricing</Eyebrow>

          <h2
            className="font-display"
            style={{
              fontSize: "clamp(28px, 3.4vw, 38px)",
              fontWeight: 700,
              margin: "12px 0 14px",
              letterSpacing: "-0.01em",
            }}
          >
            Free covers the verdict. Pro covers the why.
          </h2>

          <p style={{ color: "var(--paper-dim)", fontSize: 16, margin: 0 }}>
            Most people start free, run a few dozen scans, and upgrade once they're ready to act on
            the margin math behind each call.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
          className="pricing-grid"
        >
          {/* FREE */}
          <div
            style={{
              border: "1px solid var(--ink-line)",
              borderRadius: "var(--radius-md)",
              padding: 32,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="font-mono" style={{ fontSize: 13, color: "var(--paper-faint)", marginBottom: 8 }}>
              FREE
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
              <span className="font-display" style={{ fontSize: 40, fontWeight: 700 }}>
                $0
              </span>
              <span style={{ color: "var(--paper-dim)", fontSize: 14 }}>/ forever</span>
            </div>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 28px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {FREE_FEATURES.map((f) => (
                <FeatureRow key={f} text={f} />
              ))}
            </ul>

            <a
              href="/login"
              style={{
                marginTop: "auto",
                textAlign: "center",
                border: "1px solid var(--ink-line)",
                padding: "13px 20px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 600,
                fontSize: 15,
                color: "var(--paper)",
                textDecoration: "none",
              }}
            >
              Start scanning free
            </a>
          </div>

          {/* PRO */}
          <div
            style={{
              border: "1px solid var(--accent)",
              borderRadius: "var(--radius-md)",
              padding: 32,
              position: "relative",
              background: "linear-gradient(180deg, rgba(91,141,239,0.06), transparent 40%)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="font-mono"
              style={{
                position: "absolute",
                top: -1,
                right: 24,
                transform: "translateY(-50%)",
                background: "var(--accent)",
                color: "var(--ink)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              MOST SELLERS PICK THIS
            </div>

            <div className="font-mono" style={{ fontSize: 13, color: "var(--accent-bright)", marginBottom: 8 }}>
              PRO
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
              <span className="font-display" style={{ fontSize: 40, fontWeight: 700 }}>
                $29
              </span>
              <span style={{ color: "var(--paper-dim)", fontSize: 14 }}>
                / month, billed monthly or yearly
              </span>
            </div>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 28px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {PRO_FEATURES.map((f) => (
                <FeatureRow key={f} text={f} highlight />
              ))}
            </ul>

            <a
              href="/pricing"
              style={{
                marginTop: "auto",
                textAlign: "center",
                background: "var(--paper)",
                color: "var(--ink)",
                padding: "13px 20px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              Upgrade to Pro
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ text, highlight }: { text: string; highlight?: boolean }) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5 }}>
      <span
        style={{
          color: highlight ? "var(--accent-bright)" : "var(--buy)",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        ✓
      </span>
      <span style={{ color: "var(--paper-dim)" }}>{text}</span>
    </li>
  );
}
      <span style={{ color: "var(--paper-dim)" }}>{text}</span>
    </li>
  );
}
