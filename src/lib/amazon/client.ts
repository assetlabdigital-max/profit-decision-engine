export async function fetchAmazonProduct(asin: string) {
  const token = process.env.APIFY_API_KEY;

  console.log("====================================");
  console.log("[APIFY DEBUG] token exists =", !!token);
  console.log("[APIFY DEBUG] asin =", asin);
  console.log("====================================");

  if (!token) {
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
    console.log("[APIFY DEBUG] calling Apify...");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        asin,
      }),
    });

    console.log("[APIFY DEBUG] status =", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("[APIFY DEBUG] response error body =", text);
      throw new Error(`Apify error: ${res.status}`);
    }

    const data = await res.json();

    // ⭐ FULL RAW RESPONSE TRACE (핵심 추가)
    console.log(
      "[APIFY DEBUG] FULL RESPONSE =",
      JSON.stringify(data, null, 2)
    );

    console.log(
      "[APIFY DEBUG] items returned =",
      Array.isArray(data) ? data.length : typeof data
    );

    const item = Array.isArray(data) ? data[0] : null;

    console.log("[APIFY DEBUG] first item =", item);

    const result = {
      asin,
      title: item?.title ?? "Unknown",
      price: Number(item?.price ?? 0),
      rating: Number(item?.rating ?? 0),
      reviews: Number(item?.reviews ?? 0),
    };

    console.log("[APIFY DEBUG] normalized result =", result);

    return result;
  } catch (err) {
    console.error("[APIFY DEBUG] fetch failed:", err);

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
