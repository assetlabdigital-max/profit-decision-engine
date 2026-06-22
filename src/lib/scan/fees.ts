export function calculateAmazonFee(price: number) {
  // Amazon referral fee (평균 15%)
  const referralFee = price * 0.15;

  // FBA fulfillment (간단 모델)
  const fulfillmentFee = price < 25 ? 3.5 : 5.0;

  return {
    referralFee,
    fulfillmentFee,
    totalFees: referralFee + fulfillmentFee,
  };
}