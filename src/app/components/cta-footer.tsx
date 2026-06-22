import Link from "next/link";

export function FinalCta() {
  return (
    <section style={{ padding: "100px 0", borderTop: "1px solid var(--ink-line)", position: "relative", overflow: "hidden" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(700px circle at 50% 0%, rgba(91,141,239,0.12), transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div className="wrap" style={{ position: "relative", textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
        <h2
          className="font-display"
          style={{ fontSize: "clamp(30px, 4vw, 44px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 16px" }}
        >
          Stop guessing. Start scanning.
        </h2>
        <p style={{ color: "var(--paper-dim)", fontSize: 17, margin: "0 0 32px" }}>
          Your next sourcing decision is one ASIN away from a clear answer.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              background: "var(--paper)",
              color: "var(--ink)",
              padding: "15px 28px",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: 16,
              textDecoration: "none",
            }}
          >
            Get your first verdict free
          </Link>
        </div>
        <p className="font-mono" style={{ fontSize: 12.5, color: "var(--paper-faint)", marginTop: 18 }}>
          No credit card · Cancel anytime · Verdicts in under 5 seconds
        </p>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--ink-line)", padding: "40px 0" }}>
      <div
        className="wrap"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}
      >
        <span className="font-display" style={{ fontWeight: 700, fontSize: 15 }}>
          Profit<span style={{ color: "var(--accent-bright)" }}>/</span>Engine
        </span>
        <nav style={{ display: "flex", gap: 24, fontSize: 13.5, color: "var(--paper-faint)" }}>
          <a href="#demo" style={{ textDecoration: "none", color: "inherit" }}>
            Demo
          </a>
          <Link href="/pricing" style={{ textDecoration: "none", color: "inherit" }}>
            Pricing
          </Link>
          <Link href="/login" style={{ textDecoration: "none", color: "inherit" }}>
            Sign in
          </Link>
        </nav>
        <span style={{ fontSize: 13, color: "var(--paper-faint)" }}>
          © {new Date().getFullYear()} Profit Decision Engine
        </span>
      </div>
    </footer>
  );
}
