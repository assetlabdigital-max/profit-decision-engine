/**
 * scripts/test-retail-scrape.js
 * Usage: node scripts/test-retail-scrape.js <store-url>
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node scripts/test-retail-scrape.js <url>");
    process.exit(1);
  }

  // Dynamic import for TS module via compiled path - use require after build is heavy.
  // Instead inline minimal test using same logic as production.
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("APIFY_API_TOKEN not set");
    process.exit(1);
  }

  const cleanUrl = url.replace(/\?.*$/, "").replace(/\/$/, "");
  const searchQuery = (() => {
    const m = cleanUrl.match(/costco\.com\/p\/-\/([^/]+)\/(\d+)/i);
    return m ? m[1].replace(/-/g, " ") : null;
  })();

  const attempts = [
    { label: "startUrls-string", input: { maxItems: 5, startUrls: [cleanUrl], proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] } } },
    { label: "startUrls-object", input: { maxItems: 5, startUrls: [{ url: cleanUrl }], proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] } } },
  ];
  if (searchQuery) {
    attempts.push({ label: "searchQuery", input: { maxItems: 10, searchQuery, proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] } } });
  }

  for (const { label, input } of attempts) {
    console.log(`\n--- attempt: ${label} ---`);
    const api = `https://api.apify.com/v2/acts/parseforge~costco-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120`;
    const start = Date.now();
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const text = await res.text();
    console.log("status:", res.status, "ms:", Date.now() - start);
    try {
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : [];
      console.log("items:", items.length);
      if (items[0]) console.log(JSON.stringify(items[0], null, 2).slice(0, 800));
    } catch {
      console.log(text.slice(0, 500));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
