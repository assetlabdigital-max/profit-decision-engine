export async function fetchAmazonProduct(asin: string) {
const token = process.env.APIFY_API_KEY;

console.log("[APIFY DEBUG] token exists =", !!token);
console.log("[APIFY DEBUG] asin =", asin);

if (!token) {
throw new Error("Missing APIFY_API_KEY");
}

const url =
`https://api.apify.com/v2/acts/dtrungtin~amazon-scraper/run-sync-get-dataset-items` +
`?token=${token}`;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);

try {
console.log("[APIFY DEBUG] calling Apify...");

```
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
  console.error("[APIFY DEBUG] response =", text);
  throw new Error(`Apify error: ${res.status}`);
}

const data = await res.json();

console.log(
  "[APIFY DEBUG] items returned =",
  Array.isArray(data) ? data.length : "not-array"
);

const item = data?.[0];

console.log("[APIFY DEBUG] first item =", item);

return {
  asin,
  title: item?.title ?? "Unknown",
  price: Number(item?.price ?? 0),
  rating: Number(item?.rating ?? 0),
  reviews: Number(item?.reviews ?? 0),
};
```

} catch (err) {
console.error("[APIFY DEBUG] fetch failed:", err);

```
return {
  asin,
  title: "Fallback Product",
  price: 0,
  rating: 0,
  reviews: 0,
};
```

} finally {
clearTimeout(timeout);
}
}
