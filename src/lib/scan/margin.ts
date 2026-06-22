import { calculateAmazonFee } from "./fees";

export function calculateMargin(price: number, cost: number = 0) {
  const fees = calculateAmazonFee(price);

  const netProfit = price - fees.totalFees - cost;
  const margin = price > 0 ? netProfit / price : 0;
  const roi = cost > 0 ? netProfit / cost : 0;

  return {
    netProfit,
    margin: Number(margin.toFixed(3)),
    roi: Number(roi.toFixed(2)),
    fees,
  };
}