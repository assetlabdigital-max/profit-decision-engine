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

    // 1차: attributes에서 가격 시도
    let price = Number(
      attributes?.list_price?.[0]?.value?.amount ??
      attributes?.purchasable_offer?.[0]?.our_price?.[0]?.schedule?.[0]?.value_with_tax ??
      0
    );

    // 2차: Pricing API로 fallback
    if (!price) {
      try {
        const pricingData = await spApiCall<any>(
          `/products/pricing/v0/price?MarketplaceId=${marketplaceId}&Asins=${asin}&ItemType=Asin`
        );
        const offer = pricingData?.payload?.[0]?.Product?.Offers?.[0];
        price = Number(
          offer?.BuyingPrice?.ListingPrice?.Amount ??
          offer?.RegularPrice?.Amount ??
          0
        );
        console.log(`[amazon/catalog] pricing API fallback price for ${asin}: ${price}`);
      } catch (e) {
        console.warn(`[amazon/catalog] pricing API fallback failed for ${asin}`);
      }
    }

    const rating = Number(attributes?.average_customer_reviews?.[0]?.rating ?? 0);
    const reviews = Number(attributes?.average_customer_reviews?.[0]?.count ?? 0);

    return {
      asin,
      title: summary.itemName ?? "Unknown Product",
      price,
      rating,
      reviews,
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