export async function fetchAmazonProduct(asin: string) {
  const token = process.env.APIFY_API_KEY;

  if (!token) {
    throw new Error("Missing APIFY_API_KEY");
  }

  const url =
    `https://api.apify.com/v2/acts/dtrungtin~amazon-scraper/run-sync-get-dataset-items` +
    `?token=${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
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

    if (!res.ok) {
      throw new Error(`Apify error: ${res.status}`);
    }

    const data = await res.json();
    const item = data?.[0];

    return {
      asin,
      title: item?.title ?? "Unknown",
      price: Number(item?.price ?? 0),
      rating: Number(item?.rating ?? 0),
      reviews: Number(item?.reviews ?? 0),
    };
  } catch (err) {
    console.error("[Apify] fetch failed:", err);

    // graceful fallback (never crash production)
    return {
      asin,
      title: "Fallback Product",
      price: 0,
      rating: 0,
      reviews: 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}
