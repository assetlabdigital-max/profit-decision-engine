import { spApiCall, isAmazonEnabled } from "@/lib/amazon/client";

export interface AmazonProduct {
  asin: string;
  title: string;
  price: number;
  rating: number;
  reviews: number;
  category: string;
  brand: string | null;
  isMock: boolean;
}

export async function getProductByAsin(asin: string): Promise<AmazonProduct | null> {
  if (!isAmazonEnabled()) {
    console.log("[amazon/catalog] SP-API not configured, returning null");
    return null;
  }

  try {
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER";
    const data = await spApiCall<any>(
      `/catalog/2022-04-01/items/${asin}?marketplaceIds=${marketplaceId}&includedData=summaries,salesRanks,attributes`
    );

    const summary = data?.summaries?.[0];
    if (!summary) return null;

    const attributes = data?.attributes;
    const listPrice = attributes?.list_price?.[0]?.value?.amount ?? 0;
    const rating = attributes?.average_customer_reviews?.[0]?.rating ?? 0;
    const reviews = attributes?.average_customer_reviews?.[0]?.count ?? 0;

    return {
      asin,
      title: summary.itemName ?? "Unknown Product",
      price: Number(listPrice),
      rating: Number(rating),
      reviews: Number(reviews),
      category: summary.productType ?? "Unknown",
      brand: summary.brand ?? null,
      isMock: false,
    };
  } catch (err) {
    console.error(`[amazon/catalog] failed to fetch ASIN ${asin}:`, err);
    return null;
  }
}

export async function getProductFees(asin: string, price: number): Promise<{
  referralFee: number;
  fbaFee: number;
  totalFees: number;
} | null> {
  if (!isAmazonEnabled()) return null;

  try {
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER";
    const data = await spApiCall<any>(
      `/products/fees/v0/items/${asin}/feesEstimate`,
      {
        method: "POST",
        body: {
          FeesEstimateRequest: {
            MarketplaceId: marketplaceId,
            IsAmazonFulfilled: true,
            PriceToEstimateFees: {
              ListingPrice: { CurrencyCode: "USD", Amount: price },
            },
          },
        },
      }
    );

    const estimate = data?.FeesEstimateResult?.FeesEstimate;
    if (!estimate) return null;

    const totalFees = estimate.TotalFeesEstimate?.Amount ?? 0;
    const components = estimate.FeeDetailList ?? [];
    const referralFee = components.find((c: any) => c.FeeType === "ReferralFee")?.FinalFee?.Amount ?? 0;
    const fbaFee = components.find((c: any) => c.FeeType === "FBAFees")?.FinalFee?.Amount ?? 0;

    return {
      referralFee: Number(referralFee),
      fbaFee: Number(fbaFee),
      totalFees: Number(totalFees),
    };
  } catch (err) {
    console.error(`[amazon/fees] failed to fetch fees for ${asin}:`, err);
    return null;
  }
}