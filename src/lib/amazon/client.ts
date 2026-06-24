/**
 * STEP 7-C FINAL — REAL APIFY AMAZON SCRAPER CLIENT
 * Production-safe + full debug trace + multi-shape support
 */

export async function fetchAmazonProduct(asin: string) {
  const token = process.env.APIFY_API_KEY;

  console.log("====================================");
  console.log("[APIFY DEBUG] STEP 7 START");
  console.log("[APIFY DEBUG] token exists =", !!token);
  console.log("[APIFY DEBUG] asin =", asin);
  console.log("====================================");

  if (!token) {
    console.error("[APIFY ERROR] Missing APIFY_API_KEY");
    throw new Error("Missing APIFY_API_KEY");
  }

  const url =
    "https://api.apify.com/v2/acts/dtrungtin~amazon-scraper/run-sync-get-dataset-items" +
    `?token=${token}`;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    console.warn("[APIFY DEBUG] timeout triggered (15s)");
    controller.abort();
  }, 15000);

  try {
    console.log("[APIFY DEBUG] calling Apify... 🔥 REAL REQUEST START");

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
      console.error("[APIFY DEBUG] ERROR RESPONSE BODY =", text);
      throw new Error(`Apify error: ${res.status}`);
    }

    const data = await res.json();

    // 🔥 FULL RAW TRACE (CRITICAL STEP 7 CHECK)
    console.log(
      "[APIFY DEBUG] FULL RESPONSE =",
      JSON.stringify(data, null, 2)
    );

    console.log(
      "[APIFY DEBUG] raw type =",
      Array.isArray(data) ? "array" : typeof data
    );

    // 🔥 REAL APIFY SHAPE NORMALIZER (robust)
    const item =
      Array.isArray(data)
        ? data[0]
        : Array.isArray(data?.items)
        ? data.items[0]
        : Array.isArray(data?.results)
        ? data.results[0]
        : Array.isArray(data?.data)
        ? data.data[0]
        : data?.[0] ?? null;

    console.log("[APIFY DEBUG] normalized item =", item);

    const result = {
      asin,
      title: item?.title ?? item?.name ?? "Unknown",
      price: Number(item?.price ?? item?.currentPrice ?? 0),
      rating: Number(item?.rating ?? 0),
      reviews: Number(item?.reviews ?? item?.reviewCount ?? 0),
    };

    console.log("[APIFY DEBUG] final normalized result =", result);

    return result;
  } catch (err) {
    console.error("[APIFY DEBUG] fetch failed (SAFE FALLBACK):", err);

    return {
      asin,
      title: "Fallback Product",
      price: 0,
      rating: 0,
      reviews: 0,
    };
  } finally {
    clearTimeout(timeout);
    console.log("[APIFY DEBUG] request finished");
  }
}
