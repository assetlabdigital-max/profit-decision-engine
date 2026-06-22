export default function Hero() {
  return (
    <section style={{ position: "relative", overflow: "hidden", paddingTop: 88, paddingBottom: 88 }}>
      {/* ambient signal glow behind the hero, subtle, not animated */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(560px circle at 78% 18%, rgba(91,141,239,0.16), transparent 60%), radial-gradient(480px circle at 15% 85%, rgba(52,211,153,0.08), transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div className="wrap hero-grid" style={{ position: "relative", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 56, alignItems: "center" }}>
        <div>
          <div
            className="font-mono"
            style={{
              color: "var(--accent-bright)",
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            For Amazon sellers who hate guessing
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: "clamp(36px, 5vw, 58px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              margin: "0 0 22px",
            }}
          >
            One verdict.
            <br />
            Not forty tabs of <span style={{ color: "var(--paper-dim)" }}>spreadsheet math.</span>
          </h1>

          <p style={{ fontSize: 18, color: "var(--paper-dim)", maxWidth: 480, margin: "0 0 32px" }}>
            Paste an ASIN. In seconds you get <strong style={{ color: "var(--paper)" }}>BUY, SKIP, or RISK</strong> —
            with the margin, fees, and competition math already done. No dashboard to interpret. No
            spreadsheet to build.
          </p>

          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <a
              href="#demo"
              style={{
                background: "var(--paper)",
                color: "var(--ink)",
                padding: "14px 24px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              See a live verdict ↓
            </a>
            <a
              href="/login"
              style={{
                border: "1px solid var(--ink-line)",
                padding: "14px 24px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 600,
                fontSize: 15,
                color: "var(--paper)",
                textDecoration: "none",
              }}
            >
              Start free — no card
            </a>
          </div>

          <p className="font-mono" style={{ fontSize: 12.5, color: "var(--paper-faint)", marginTop: 18 }}>
            Free tier forever · Upgrade for full profit breakdowns
          </p>
        </div>

        <HeroVerdictCard />
      </div>
    </section>
  );
}

function HeroVerdictCard() {
  return (
    <div
      style={{
        background: "var(--ink-1)",
        border: "1px solid var(--ink-line)",
        borderRadius: "var(--radius-md)",
        padding: 24,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <span className="font-mono" style={{ fontSize: 12, color: "var(--paper-faint)" }}>
          B0CXXX—WIRELESS CHARGER
        </span>
        <span className="verdict verdict--buy">Buy</span>
      </div>

      <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 0", margin: "0 0 18px" }}>
        <Metric label="Sell price" value="$24.99" />
        <Metric label="Net margin" value="31.4%" tone="buy" />
        <Metric label="Est. fees" value="$8.12" />
        <Metric label="ROI" value="64.0%" tone="buy" />
        <Metric label="Competitors" value="6 sellers" />
        <Metric label="Reviews" value="1,204 · 4.6★" />
      </dl>

      <div
        style={{
          borderTop: "1px solid var(--ink-line)",
          paddingTop: 14,
          fontSize: 13,
          color: "var(--paper-dim)",
        }}
      >
        Healthy margin, low competition, and a steady review trend. This one clears the bar.
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "buy" | "risk" }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--paper-faint)", marginBottom: 3 }}>{label}</div>
      <div
        className="font-mono"
        style={{ fontSize: 16, fontWeight: 500, color: tone === "buy" ? "var(--buy)" : "var(--paper)" }}
      >
        {value}
      </div>
    </div>
  );
}
