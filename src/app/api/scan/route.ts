import { NextResponse } from "next/server";
import { isApifyEnabled } from "@/lib/runtime-config";

/**
 * 🔥 REAL PROFIT DECISION ENGINE
 */
export async function POST(req: Request) {
  try {
    const { asin } = await req.json();

    if (!asin) {
      return NextResponse.json(
        { error: "Missing ASIN" },
        { status: 400 }
      );
    }

    // -----------------------------------
    // 1. AMAZON PRODUCT (mock for now)
    // -----------------------------------
    const product = await getAmazonProduct(asin);

    // -----------------------------------
    // 2. TIKTOK TREND DATA
    // -----------------------------------
    const trend = await getTikTokTrend(product.keyword);

    // -----------------------------------
    // 3. COMPETITION SCORE
    // -----------------------------------
    const competition = estimateCompetition(product.category);

    // -----------------------------------
    // 4. PROFIT CALCULATION
    // -----------------------------------
    const fees = calculateAmazonFees(product.price);

    const profit =
      product.price -
      fees.total -
      product.cost;

    const score = calculateScore({
      profit,
      trend,
      competition,
    });

    // -----------------------------------
    // 5. DECISION ENGINE
    // -----------------------------------
    const decision = getDecision(score);

    return NextResponse.json({
      asin,
      product,
      trend,
      competition,
      fees,
      profit: Number(profit.toFixed(2)),
      score,
      decision,
    });
  } catch (err) {
    console.error("[scan] error:", err);
    return NextResponse.json(
      { error: "Scan failed" },
      { status: 500 }
    );
  }
}

/* ---------------------------
   AMAZON (mock for now)
----------------------------*/
async function getAmazonProduct(asin: string) {
  return {
    asin,
    title: "Sample Product",
    price: 29.99,
    cost: 10.0,
    category: "Home",
    keyword: "home gadget",
  };
}

/* ---------------------------
   TIKTOK TREND
----------------------------*/
async function getTikTokTrend(keyword: string) {
  const isLive = isApifyEnabled();

  if (!isLive) {
    return {
      views: 120000000,
      growth: 0.18,
      mock: true,
    };
  }

  // 👉 Apify 연결 자리 (나중에 실제 actor 붙임)
  return {
    views: 250000000,
    growth: 0.42,
    mock: false,
  };
}

/* ---------------------------
   COMPETITION
----------------------------*/
function estimateCompetition(category: string) {
  const map: Record<string, number> = {
    Home: 0.6,
    Beauty: 0.8,
    Sports: 0.5,
    Tech: 0.9,
  };

  return map[category] ?? 0.7;
}

/* ---------------------------
   AMAZON FEES (simplified)
----------------------------*/
function calculateAmazonFees(price: number) {
  return {
    referral: price * 0.15,
    fulfillment: 4.5,
    total: price * 0.15 + 4.5,
  };
}

/* ---------------------------
   SCORING ENGINE
----------------------------*/
function calculateScore({
  profit,
  trend,
  competition,
}: any) {
  const trendScore = trend.views / 1_000_000;

  return (
    profit * 2 +
    trendScore * 0.3 -
    competition * 10
  );
}

/* ---------------------------
   DECISION LOGIC
----------------------------*/
function getDecision(score: number) {
  if (score > 20) return "STRONG BUY";
  if (score > 10) return "TEST PRODUCT";
  if (score > 0) return "WEAK OPPORTUNITY";
  return "AVOID";
}