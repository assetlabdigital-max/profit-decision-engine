import { auth } from "@/auth/auth";
import { resolveTier } from "@/lib/scan/resolve-tier";
import { TiktokTrendingPanel } from "@/app/dashboard/tiktok-trending-panel";

export default async function DashboardPage() {
  const session = await auth().catch(() => null);
  const { tier, usedFallback } = await resolveTier();

  return (
    <main style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
      <h1>Dashboard</h1>
      <p>
        Signed in as <strong>{session?.user?.email ?? "unknown"}</strong> — tier:{" "}
        <strong>{tier}</strong>
        {usedFallback && <em style={{ color: "#a60" }}> (mock/fallback data)</em>}
      </p>

      {tier === "free" ? (
        <p>
          You're on the Free plan. <a href="/pricing">Upgrade to Pro</a> for full profit, fee, and
          competition breakdowns.
        </p>
      ) : (
        <p>You're on Pro. Manage billing from the pricing page.</p>
      )}

      <h2>Run a scan</h2>
      <p>POST an ASIN to <code>/api/scan</code> to test the decision engine.</p>
      <pre style={{ background: "#f4f4f4", padding: 12, borderRadius: 6 }}>
        {`curl -X POST ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/scan \\
  -H "Content-Type: application/json" \\
  -d '{"asin":"B0EXAMPLE1"}'`}
      </pre>

      <TiktokTrendingPanel />
    </main>
  );
}
