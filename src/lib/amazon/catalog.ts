import { spApiCall, isAmazonEnabled } from "@/lib/amazon/client";
import { isApifyUsageLimitExceeded, runApifyActor } from "@/lib/apify/client";

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

async function fetchPriceFromSpApi(asin: string): Promise<{
  price: number;
  rating: number;
  reviews: number;
  category: string | null;
} | null> {
  try {
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER";
    const data = await spApiCall<any>(
      `/products/pricing/v0/price?MarketplaceId=${marketplaceId}&ItemType=Asin&Asins=${asin}`
    );

    const payload = data?.payload?.[0];
    const competitivePrices =
      payload?.Product?.CompetitivePricing?.CompetitivePrices ?? [];

    let amount: number | null = null;
    for (const entry of competitivePrices) {
      const listing = entry?.Price?.ListingPrice?.Amount ?? entry?.Price?.LandedPrice?.Amount;
      const numeric = Number(listing);
      if (Number.isFinite(numeric) && numeric > 0) {
        amount = numeric;
        break;
      }
    }

    if (amount == null) {
      return null;
    }

    console.log(`[amazon/sp-api] price=${amount} for ${asin}`);
    return { price: amount, rating: 0, reviews: 0, category: null };
  } catch (err) {
    console.warn(`[amazon/sp-api] pricing failed for ${asin}:`, err);
    return null;
  }
}

async function fetchPriceFromApify(asin: string): Promise<{
  price: number;
  rating: number;
  reviews: number;
  category: string | null;
} | null> {
  if (isApifyUsageLimitExceeded()) return null;
  if (process.env.AMAZON_PRICE_VIA_APIFY !== "true") return null;

  const run = await runApifyActor<Record<string, unknown>>(
    "dtrungtin~amazon-scraper",
    {
      startUrls: [{ url: `https://www.amazon.com/dp/${asin}`, method: "GET" }],
      maxItems: 1,
      proxyConfiguration: { useApifyProxy: true },
    },
    { timeoutSecs: 60 }
  );

  if (!run.ok) {
    console.warn(`[amazon/apify] failed for ${asin}: ${run.error}`);
    return null;
  }

  const item = run.items[0];
  if (!item) return null;

  const price = Number(
    item.price ??
      item.currentPrice ??
      item.wasPrice ??
      (item.priceRange as { min?: number } | undefined)?.min ??
      0
  );
  const rating = Number(item.reviewRating ?? item.stars ?? item.rating ?? 0);
  const reviews = Number(item.reviewCount ?? item.reviewsCount ?? item.reviews ?? 0);
  const category = Array.isArray(item.categories) ? String(item.categories[0]) : null;

  console.log(`[amazon/apify] price=${price}, rating=${rating}, reviews=${reviews}, category=${category}`);

  return { price, rating, reviews, category };
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

    const spPrice = await fetchPriceFromSpApi(asin);
    const apifyData = spPrice?.price ? null : await fetchPriceFromApify(asin);
    const priceSource = spPrice ?? apifyData;

    const price = priceSource?.price ?? 0;
    const rating = priceSource?.rating ?? 0;
    const reviews = priceSource?.reviews ?? 0;
    const category = priceSource?.category ?? summary.productType ?? "Unknown";

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
