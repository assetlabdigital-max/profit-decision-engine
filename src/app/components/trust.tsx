import { Eyebrow } from "@/app/components/demo";

const COMPARISON = [
  {
    label: "What you get",
    legacy: "A dashboard with 40+ metrics per product",
    ours: "One verdict, with the math that produced it",
  },
  {
    label: "Time to decide",
    legacy: "10–40 minutes of cross-referencing tabs",
    ours: "Under 5 seconds",
  },
  {
    label: "When margin is thin",
    legacy: "Buried in a column you have to know to check",
    ours: "Flagged as SKIP before you waste a click",
  },
  {
    label: "When reviews are slipping",
    legacy: "A graph you have to notice the slope of",
    ours: "Flagged as RISK with the specific reason",
  },
];

export default function Trust() {
  return (
    <section id="trust" style={{ padding: "96px 0", borderTop: "1px solid var(--ink-line)", background: "var(--ink-1)" }}>
      <div className="wrap">
        <div style={{ maxWidth: 580, marginBottom: 48 }}>
          <Eyebrow>Why this isn't another research dashboard</Eyebrow>
          <h2
            className="font-display"
            style={{ fontSize: "clamp(28px, 3.4vw, 38px)", fontWeight: 700, margin: "12px 0 14px", letterSpacing: "-0.01em" }}
          >
            Most tools hand you data. This hands you a decision.
          </h2>
          <p style={{ color: "var(--paper-dim)", fontSize: 16, margin: 0 }}>
            Research suites are built to show you everything they know. That's the right job for an
            analyst — and the wrong job when you're trying to source 40 products a week. We built the
            opposite: the same underlying math, collapsed into a verdict you can act on immediately.
          </p>
        </div>

        <div
          style={{
            border: "1px solid var(--ink-line)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              background: "var(--ink-2)",
              borderBottom: "1px solid var(--ink-line)",
            }}
            className="trust-row"
          >
            <HeadCell></HeadCell>
            <HeadCell muted>Typical research suite</HeadCell>
            <HeadCell accent>Profit Decision Engine</HeadCell>
          </div>

          {COMPARISON.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                borderBottom: i === COMPARISON.length - 1 ? "none" : "1px solid var(--ink-line)",
              }}
              className="trust-row"
            >
              <Cell style={{ fontWeight: 600, color: "var(--paper)" }}>{row.label}</Cell>
              <Cell style={{ color: "var(--paper-dim)" }}>{row.legacy}</Cell>
              <Cell style={{ color: "var(--buy)" }}>{row.ours}</Cell>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginTop: 40,
          }}
          className="trust-stats"
        >
          <Stat value="< 5 sec" label="Median time from ASIN to verdict" />
          <Stat value="100%" label="Of scans show the margin math, not just a score" />
          <Stat value="0" label="Dashboards you need a tutorial to read" />
        </div>
      </div>
    </section>
  );
}

function HeadCell({ children, muted, accent }: { children?: React.ReactNode; muted?: boolean; accent?: boolean }) {
  return (
    <div
      className="font-mono"
      style={{
        padding: "14px 20px",
        fontSize: 12,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: accent ? "var(--accent-bright)" : muted ? "var(--paper-faint)" : "transparent",
      }}
    >
      {children}
    </div>
  );
}

function Cell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ padding: "18px 20px", fontSize: 14.5, ...style }}>{children}</div>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 18 }}>
      <div className="font-display" style={{ fontSize: 32, fontWeight: 700, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 14, color: "var(--paper-dim)" }}>{label}</div>
    </div>
  );
}
