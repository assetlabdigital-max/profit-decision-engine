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

async function fetchPriceFromApify(asin: string): Promise<{
  price: number;
  rating: number;
  reviews: number;
  category: string | null;
} | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/dtrungtin~amazon-scraper/run-sync-get-dataset-items?token=${token}&timeout=60`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: [{
            url: `https://www.amazon.com/dp/${asin}`,
            method: "GET"
          }],
          maxItems: 1,
          proxyConfiguration: { useApifyProxy: true },
        }),
      }
    );

    if (!res.ok) {
      console.warn(`[amazon/apify] HTTP ${res.status} for ${asin}`);
      return null;
    }

    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : null;
    if (!item) return null;

    const price = Number(item.price ?? item.currentPrice ?? 0);
    const rating = Number(item.reviewRating ?? item.stars ?? item.rating ?? 0);
    const reviews = Number(item.reviewCount ?? item.reviewsCount ?? item.reviews ?? 0);
    const category = Array.isArray(item.categories) ? item.categories[0] : null;

    console.log(`[amazon/apify] price=${price}, rating=${rating}, reviews=${reviews}, category=${category}`);

    return { price, rating, reviews, category };
  } catch (err) {
    console.error(`[amazon/apify] failed for ${asin}:`, err);
    return null;
  }
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

    const title = summary.itemName ?? "Unknown Product";
    const brand = summary.brand ?? null;

    const apifyData = await fetchPriceFromApify(asin);
    const price = apifyData?.price ?? 0;
    const rating = apifyData?.rating ?? 0;
    const reviews = apifyData?.reviews ?? 0;
    const category = apifyData?.category ?? summary.productType ?? "Unknown";

    console.log(`[amazon/catalog] ${asin} — title: ${title}, price: ${price}, rating: ${rating}, reviews: ${reviews}`);

    return {
      asin,
      title,
      price,
      rating,
      reviews,
      category,
      brand,
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