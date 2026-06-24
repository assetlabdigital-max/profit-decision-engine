const APIFY_COST_PER_CALL = 0.02;
const INFRA_COST_PER_CALL = 0.001;

const scanCost = APIFY_COST_PER_CALL + INFRA_COST_PER_CALL;

const estimatedProfit =
  marginData.margin * amazon.price - scanCost;

console.log("====================================");
console.log("[STEP10 ECONOMICS]");
console.log("price =", amazon.price);
console.log("scanCost =", scanCost);
console.log("estimatedProfit =", estimatedProfit);
console.log("====================================");

const result = {
  asin: amazon.asin,
  title: amazon.title,

  price: amazon.price,
  rating: amazon.rating ?? 0,
  reviewCount: amazon.reviews ?? 0,

  category: "Amazon",
  isMock: !shouldUseApify,
  generatedAt: new Date().toISOString(),

  verdict,
  verdictReason,

  netMargin: shouldUseApify ? marginData.margin : undefined,
  roi: shouldUseApify ? marginData.roi : undefined,
  fees: shouldUseApify ? marginData.fees.totalFees : undefined,

  competition: shouldUseApify ? competitionLevel : undefined,

  // 💰 STEP 10 NEW
  apifyCost: APIFY_COST_PER_CALL,
  scanCost,
  estimatedProfit,
};
