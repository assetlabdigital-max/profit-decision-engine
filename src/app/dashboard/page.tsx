import UpgradeButton from "@/app/components/UpgradeButton";
import { auth } from "@/auth/auth";
import { resolveTier } from "@/lib/scan/resolve-tier";
import { TiktokTrendingPanel } from "@/app/dashboard/tiktok-trending-panel";

export default async function DashboardPage() {
  const session = await auth().catch(() => null);

  const { tier, usedFallback } = await resolveTier();

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "60px auto",
        padding: "0 24px",
      }}
    >
      <h1>Dashboard</h1>

      <p>
        Signed in as{" "}
        <strong>{session?.user?.email ?? "unknown"}</strong>
        {" — "}
        tier: <strong>{tier}</strong>

        {usedFallback && (
          <em style={{ color: "#b66", marginLeft: 8 }}>
            (fallback mode)
          </em>
        )}
      </p>

      {tier === "free" ? (
        <>
          <p>You're on the Free plan.</p>

          <UpgradeButton
            email={session?.user?.email ?? ""}
          />

          <p style={{ marginTop: 20 }}>
            Pro unlocks:
          </p>

          <ul>
            <li>✔ Profit calculation</li>
            <li>✔ Amazon fee breakdown</li>
            <li>✔ Competition score</li>
            <li>✔ AI sourcing recommendation</li>
            <li>✔ Unlimited scans</li>
          </ul>
        </>
      ) : (
        <>
          <p style={{ color: "green" }}>
            ✅ You're on Pro.
          </p>
        </>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>Run a scan</h2>

      <p>
        POST an ASIN to{" "}
        <code>/api/scan</code> to test the
        decision engine.
      </p>

      <pre
        style={{
          background: "#f4f4f4",
          padding: 12,
          borderRadius: 6,
          overflowX: "auto",
        }}
      >
{`curl -X POST ${
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000"
}/api/scan \\
-H "Content-Type: application/json" \\
-d '{"asin":"B0EXAMPLE1"}'`}
      </pre>

      <hr style={{ margin: "32px 0" }} />

      <h2>TikTok Research</h2>

      <p
        style={{
          color: "#666",
          marginBottom: 16,
        }}
      >
        Manual refresh only. Dashboard never calls
        Apify automatically.
      </p>

      <TiktokTrendingPanel />
    </main>
  );
}
