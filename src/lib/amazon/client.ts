/**
 * Apify Amazon Scraper - Production Stable Client
 * ------------------------------------------------
 * - timeout safety
 * - API key validation
 * - full debug trace (dev-safe)
 * - multi-shape response normalization
 * - guaranteed fallback (NEVER throws in production flow)
 */

export interface AmazonProduct {
  asin: string;
  title: string;
  price: number;
  rating: number;
  reviews: number;
}

export async function fetchAmazonProduct(
  asin: string
): Promise<AmazonProduct> {
  const token = process.env.APIFY_API_KEY;

  console.log("====================================");
  console.log("[APIFY DEBUG] START fetchAmazonProduct");
  console.log("[APIFY DEBUG] token exists =", !!token);
  console.log("[APIFY DEBUG] asin =", asin);
  console.log("====================================");

  // 🔴 HARD GUARD (never proceed without API key)
  if (!token) {
    console.error("[APIFY DEBUG] Missing APIFY_API_KEY");
    return fallback(asin);
  }

  const url =
    "https://api.apify.com/v2/acts/dtrungtin~amazon-scraper/run-sync-get-dataset-items" +
    `?token=${token}`;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    console.warn("[APIFY DEBUG] TIMEOUT triggered (15s)");
    controller.abort();
  }, 15000);

  try {
    console.log("[APIFY DEBUG] calling Apify API...");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({ asin }),
    });

    console.log("[APIFY DEBUG] status =", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("[APIFY DEBUG] ERROR RESPONSE =", text);
      return fallback(asin);
    }

    const data = await res.json();

    console.log(
      "[APIFY DEBUG] FULL RESPONSE =",
      JSON.stringify(data, null, 2)
    );

    const item = normalize(data);

    console.log("[APIFY DEBUG] normalized item =", item);

    const result: AmazonProduct = {
      asin,
      title: item?.title ?? "Unknown",
      price: toNumber(item?.price),
      rating: toNumber(item?.rating),
      reviews: toNumber(item?.reviews),
    };

    console.log("[APIFY DEBUG] FINAL RESULT =", result);

    return result;
  } catch (err) {
    console.error("[APIFY DEBUG] FETCH FAILED:", err);
    return fallback(asin);
  } finally {
    clearTimeout(timeout);
    console.log("[APIFY DEBUG] request finished");
  }
}

/**
 * Normalize multiple Apify response shapes
 */
function normalize(data: any) {
  if (Array.isArray(data)) return data[0];
  if (Array.isArray(data?.items)) return data.items[0];
  if (Array.isArray(data?.results)) return data.results[0];
  if (Array.isArray(data?.data)) return data.data[0];
  return data?.[0] ?? null;
}

/**
 * Safe number conversion
 */
function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * NEVER-FAIL fallback (production safety rule)
 */
function fallback(asin: string): AmazonProduct {
  console.warn("[APIFY DEBUG] USING FALLBACK for asin =", asin);

  return {
    asin,
    title: "Fallback Product",
    price: 0,
    rating: 0,
    reviews: 0,
  };
}
