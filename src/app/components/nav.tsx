import Link from "next/link";

export default function Nav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(10,13,18,0.82)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--ink-line)",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        <Link
          href="/"
          className="font-display"
          style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", textDecoration: "none" }}
        >
          Profit<span style={{ color: "var(--accent-bright)" }}>/</span>Engine
        </Link>

        <nav
          style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 14 }}
          className="nav-links"
        >
          <a href="#demo" style={{ color: "var(--paper-dim)", textDecoration: "none" }}>
            Demo
          </a>
          <a href="#trust" style={{ color: "var(--paper-dim)", textDecoration: "none" }}>
            Why it's different
          </a>
          <Link href="/pricing" style={{ color: "var(--paper-dim)", textDecoration: "none" }}>
            Pricing
          </Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/login"
            style={{ color: "var(--paper-dim)", textDecoration: "none", fontSize: 14 }}
          >
            Sign in
          </Link>
          <Link
            href="/login"
            style={{
              background: "var(--paper)",
              color: "var(--ink)",
              padding: "9px 16px",
              borderRadius: "var(--radius-sm)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Try it free
          </Link>
        </div>
      </div>
    </header>
  );
}
