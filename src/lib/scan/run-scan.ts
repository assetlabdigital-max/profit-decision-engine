const FORCE_REAL = process.env.FORCE_REAL_APIFY === "true";
const USE_MOCK = process.env.USE_MOCK === "true";

console.log("====================================");
console.log("[STEP9 DEBUG] FORCE_REAL =", FORCE_REAL);
console.log("[STEP9 DEBUG] USE_MOCK =", USE_MOCK);
console.log("====================================");

const shouldUseApify = FORCE_REAL || isPro;

let amazon = null;

console.log("[STEP9 DEBUG] DATA PIPELINE START =", {
  shouldUseApify,
  tier,
  asin,
});

try {
  // 1️⃣ REAL APIFY FIRST
  if (shouldUseApify) {
    console.log("🔥 STEP9: TRY REAL APIFY FIRST");

    amazon = await fetchAmazonProduct(asin);
  }

  // 2️⃣ FALLBACK LOGIC
  if (!amazon || USE_MOCK) {
    console.warn("[STEP9] switching to MOCK fallback");

    amazon = {
      asin,
      title: `Mock Product ${asin}`,
      price: Math.floor(Math.random() * 50) + 10,
      rating: 4 + Math.random(),
      reviews: Math.floor(Math.random() * 1000),
    };
  }

  console.log("[STEP9 DEBUG] FINAL AMAZON SOURCE =", amazon);

  const marginData = calculateMargin(amazon.price, request.cost ?? 0);
  const competition = calculateCompetition(
    amazon.reviews ?? 0,
    amazon.rating ?? 0
  );

  const competitionLevel: "low" | "medium" | "high" =
    competition.level;

  const verdict =
    marginData.margin > 0.25 && competitionLevel === "low"
      ? "BUY"
      : marginData.margin > 0.1
      ? "SKIP"
      : "RISK";

  const result = {
    asin: amazon.asin,
    title: amazon.title,
    price: amazon.price,
    rating: amazon.rating ?? 0,
    reviewCount: amazon.reviews ?? 0,
    category: "Amazon",
    isMock: !shouldUseApify && !amazon?.isReal,
    generatedAt: new Date().toISOString(),

    verdict,
    verdictReason:
      verdict === "BUY"
        ? "High margin + low competition"
        : verdict === "SKIP"
        ? "Moderate opportunity"
        : "Low margin or high risk",
  };

  console.log("====================================");
  console.log("[STEP9 FINAL RESULT]", result);
  console.log("====================================");

  return {
    result,
    mock: !shouldUseApify,
  };
} catch (err) {
  console.error("[STEP9 CRITICAL ERROR]", err);

  return {
    result: {
      asin,
      title: "SYSTEM FALLBACK",
      price: 0,
      rating: 0,
      reviewCount: 0,
      category: "ERROR",
      isMock: true,
      generatedAt: new Date().toISOString(),
      verdict: "RISK",
      verdictReason: "System failure fallback",
    },
    mock: true,
  };
}
