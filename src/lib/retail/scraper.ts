/**
 * src/lib/retail/scraper.ts
 *
 * NODE RUNTIME ONLY. Detects retail store from URL and scrapes
 * product name + price using Apify actors.
 */

export interface RetailProduct {
  storeName: string;
  storePrice: number;
  productName: string;
  productUrl: string;
  currency: string;
}

type StoreConfig = {
  name: string;
  actorId: string;
  inputBuilder: (url: string) => Record<string, unknown>;
  parser: (item: any) => { name: string; price: number } | null;
};

const STORE_CONFIGS: StoreConfig[] = [
  {
    name: "Costco",
    actorId: "parseforge~costco-scraper",
    inputBuilder: (url) => ({
      startUrls: [{ url }],
      maxItems: 1,
      proxyConfiguration: { useApifyProxy: true },
    }),
    parser: (item) => ({
      name: item?.name ?? item?.title ?? item?.productName ?? "",
      price: Number(item?.memberPrice ?? item?.price ?? item?.salePrice ?? 0),
    }),
  },
  {
    name: "Walmart",
    actorId: "dtrungtin~walmart-scraper",
    inputBuilder: (url) => ({
      startUrls: [{ url }],
      maxItems: 1,
      proxyConfiguration: { useApifyProxy: true },
    }),
    parser: (item) => ({
      name: item?.name ?? item?.title ?? "",
      price: Number(item?.price ?? item?.currentPrice ?? 0),
    }),
  },
  {
    name: "Target",
    actorId: "dtrungtin~target-scraper",
    inputBuilder: (url) => ({
      startUrls: [{ url }],
      maxItems: 1,
      proxyConfiguration: { useApifyProxy: true },
    }),
    parser: (item) => ({
      name: item?.name ?? item?.title ?? "",
      price: Number(item?.price ?? item?.currentPrice ?? 0),
    }),
  },
  {
    name: "Sam's Club",
    actorId: "dtrungtin~sams-club-scraper",
    inputBuilder: (url) => ({
      startUrls: [{ url }],
      maxItems: 1,
      proxyConfiguration: { useApifyProxy: true },
    }),
    parser: (item) => ({
      name: item?.name ?? item?.title ?? "",
      price: Number(item?.price ?? item?.currentPrice ?? 0),
    }),
  },
];

function detectStore(url: string): StoreConfig | null {
  const lower = url.toLowerCase();
  if (lower.includes("costco.com")) return STORE_CONFIGS[0];
  if (lower.includes("walmart.com")) return STORE_CONFIGS[1];
  if (lower.includes("target.com")) return STORE_CONFIGS[2];
  if (lower.includes("samsclub.com")) return STORE_CONFIGS[3];
  return null;
}

export function isRetailUrl(url: string): boolean {
  return detectStore(url) !== null;
}

export async function scrapeRetailProduct(url: string): Promise<RetailProduct | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("[retail/scraper] APIFY_API_TOKEN not set");
    return null;
  }

  const store = detectStore(url);
  if (!store) {
    console.warn("[retail/scraper] unsupported store URL:", url);
    return null;
  }

  console.log(`[retail/scraper] scraping ${store.name} URL: ${url}`);

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${store.actorId}/run-sync-get-dataset-items?token=${token}&timeout=60`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(store.inputBuilder(url)),
      }
    );

    if (!res.ok) {
      console.error(`[retail/scraper] HTTP ${res.status} from Apify for ${store.name}`);
      return null;
    }

    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : null;
    if (!item) {
      console.warn(`[retail/scraper] no items returned for ${store.name}`);
      return null;
    }

    const parsed = store.parser(item);
    if (!parsed || !parsed.name || !parsed.price) {
      console.warn(`[retail/scraper] could not parse name/price from ${store.name} response`);
      return null;
    }

    console.log(`[retail/scraper] ${store.name}: name="${parsed.name}", price=${parsed.price}`);

    return {
      storeName: store.name,
      storePrice: parsed.price,
      productName: parsed.name,
      productUrl: url,
      currency: "USD",
    };
  } catch (err) {
    console.error(`[retail/scraper] failed for ${store.name}:`, err);
    return null;
  }
}