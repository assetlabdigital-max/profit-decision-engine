/**
 * scripts/test-retail-scrape.js
 * Usage: node scripts/test-retail-scrape.js <store-url>
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const RESIDENTIAL_PROXY = { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] };

function walmartItemId(url) {
  const m = url.match(/walmart\.com\/ip\/(?:[^/]+\/)?(\d+)/i);
  return m ? m[1] : null;
}

function walmartSearch(url) {
  const m = url.match(/walmart\.com\/ip\/([^/]+)\/(\d+)/i);
  return m && !/^\d+$/.test(m[1]) ? m[1].replace(/-/g, " ") : null;
}

async function runAttempt(label, actorId, input, token) {
  console.log(`\n--- ${label} ---`);
  const api = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120`;
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
    if (items[0]) console.log(JSON.stringify(items[0], null, 2).slice(0, 1000));
  } catch {
    console.log(text.slice(0, 500));
  }
}

async function main() {
  const url = (process.argv[2] || "").replace(/\?.*$/, "").replace(/\/$/, "");
  if (!url) {
    console.error("Usage: node scripts/test-retail-scrape.js <url>");
    process.exit(1);
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("APIFY_API_TOKEN not set");
    process.exit(1);
  }

  if (url.includes("walmart.com")) {
    const itemId = walmartItemId(url);
    const search = walmartSearch(url);
    if (itemId) {
      await runAttempt("extractor-itemIds", "khadinakbar~walmart-data-extractor", {
        mode: "itemIds",
        itemIds: [itemId],
        maxProducts: 1,
        proxyConfiguration: RESIDENTIAL_PROXY,
      }, token);
    }
    await runAttempt("extractor-productUrls", "khadinakbar~walmart-data-extractor", {
      mode: "productUrls",
      productUrls: [url],
      maxProducts: 1,
      proxyConfiguration: RESIDENTIAL_PROXY,
    }, token);
    if (search) {
      await runAttempt("extractor-search", "khadinakbar~walmart-data-extractor", {
        mode: "search",
        searchQuery: search,
        maxProducts: 5,
        proxyConfiguration: RESIDENTIAL_PROXY,
      }, token);
    }
    return;
  }

  console.log("Only walmart URLs supported in this debug script for now.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

