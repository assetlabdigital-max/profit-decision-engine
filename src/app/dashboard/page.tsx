import { Suspense } from "react";
import { auth } from "@/auth/auth";
import { resolveTier } from "@/lib/scan/resolve-tier";
import { RETAIL_STORE_HINT } from "@/lib/retail/stores";
import { TiktokTrendingPanel } from "@/app/dashboard/tiktok-trending-panel";
import { ScanPanel } from "@/app/dashboard/scan-panel";
import { CheckoutBanner } from "@/app/dashboard/checkout-banner";

export default async function DashboardPage() {
  const session = await auth().catch(() => null);
  const { tier, usedFallback } = await resolveTier();

  return (
    <main style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
      <h1>Profit Decision Engine</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Signed in as <strong style={{ color: "#111" }}>{session?.user?.email ?? "unknown"}</strong>{" "}
        — plan: <strong style={{ color: "#111" }}>{tier}</strong>
        {usedFallback && <em style={{ color: "#a60" }}> (fallback mode)</em>}
        {tier === "free" && (
          <> · <a href="/pricing" style={{ color: "#2563eb" }}>Upgrade to Pro</a></>
        )}
      </p>

      {tier === "pro" && (
        <p style={{ color: "#22c55e", fontWeight: 600, fontSize: 14 }}>✅ You're on Pro.</p>
      )}

      <Suspense fallback={null}>
        <CheckoutBanner />
      </Suspense>

      <h2 style={{ marginTop: 28 }}>Scan a product</h2>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
         Enter an Amazon ASIN — or paste a {RETAIL_STORE_HINT} product URL to find the same item on Amazon and calculate your arbitrage margin.
      </p>
      <ScanPanel tier={tier} />

      <TiktokTrendingPanel />
    </main>
  );
}