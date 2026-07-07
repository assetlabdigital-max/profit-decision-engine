/**
 * src/lib/retail/scraper.ts
 *
 * NODE RUNTIME ONLY. Detects retail store from URL and scrapes
 * product name + price using Apify actors.
 */

import { runApifyActor } from "@/lib/apify/client";

export interface RetailProduct {
  storeName: string;
  storePrice: number;
  productName: string;
  productUrl: string;
  currency: string;
  brand?: string;
}

type StoreConfig = {
  name: string;
  actorId: string;
  inputBuilder: (url: string) => Record<string, unknown>;
  parser: (item: Record<string, unknown>) => { name: string; price: number; brand?: string } | null;
};

const RESIDENTIAL_PROXY = {
  useApifyProxy: true,
  apifyProxyGroups: ["RESIDENTIAL"],
};

function parsePrice(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue;
    const numeric =
      typeof candidate === "number"
        ? candidate
        : Number(String(candidate).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

function parseName(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

/** Strip tracking/query params — Apify actors expect clean product URLs. */
export function normalizeRetailUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

const STORE_CONFIGS: StoreConfig[] = [
  {
    name: "Costco",
    actorId: "parseforge~costco-scraper",
    inputBuilder: (url) => ({
      maxItems: 1,
      startUrls: [{ url }],
      proxyConfiguration: RESIDENTIAL_PROXY,
    }),
    parser: (item) => {
      const name = parseName(item.name, item.title, item.productName);
      const price = parsePrice(item.memberPrice, item.onlinePrice, item.price, item.salePrice);
      const brand = parseName(item.brand) || undefined;
      if (!name || price == null) return null;
      return { name, price, brand };
    },
  },
  {
    name: "Walmart",
    actorId: "silentflow~walmart-scraper",
    inputBuilder: (url) => ({
      urls: [{ url }],
      maxItems: 1,
      includeDetails: true,
      proxyConfiguration: RESIDENTIAL_PROXY,
    }),
    parser: (item) => {
      const name = parseName(item.name, item.title, item.productName);
      const price = parsePrice(item.price, item.currentPrice, item.priceString, item.salePrice);
      const brand = parseName(item.brand) || undefined;
      if (!name || price == null) return null;
      return { name, price, brand };
    },
  },
  {
    name: "Target",
    actorId: "parseforge~target-scraper",
    inputBuilder: (url) => ({
      maxItems: 1,
      startUrls: [{ url }],
      includeDetails: true,
      proxyConfiguration: RESIDENTIAL_PROXY,
    }),
    parser: (item) => {
      const name = parseName(item.name, item.title, item.productName);
      const price = parsePrice(item.price, item.salePrice, item.currentPrice);
      const brand = parseName(item.brand) || undefined;
      if (!name || price == null) return null;
      return { name, price, brand };
    },
  },
  {
    name: "Sam's Club",
    actorId: "kawsar~sam-s-club-product-scraper",
    inputBuilder: (url) => ({
      maxItems: 1,
      startUrls: [{ url }],
    }),
    parser: (item) => {
      const name = parseName(item.product_name, item.name, item.title);
      const price = parsePrice(item.price, item.member_price, item.original_price);
      const brand = parseName(item.brand) || undefined;
      if (!name || price == null) return null;
      return { name, price, brand };
    },
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
  const cleanUrl = normalizeRetailUrl(url);
  const store = detectStore(cleanUrl);
  if (!store) {
    console.warn("[retail/scraper] unsupported store URL:", url);
    return null;
  }

  console.log(`[retail/scraper] scraping ${store.name} URL: ${cleanUrl}`);

  const run = await runApifyActor<Record<string, unknown>>(store.actorId, store.inputBuilder(cleanUrl));

  if (!run.ok) {
    console.error(`[retail/scraper] Apify failed for ${store.name}:`, run.error);
    return null;
  }

  const item = run.items[0];
  if (!item) {
    console.warn(`[retail/scraper] no items returned for ${store.name}`);
    return null;
  }

  const parsed = store.parser(item);
  if (!parsed) {
    console.warn(
      `[retail/scraper] could not parse name/price from ${store.name} response:`,
      JSON.stringify(item).slice(0, 400)
    );
    return null;
  }

  console.log(`[retail/scraper] ${store.name}: name="${parsed.name}", price=${parsed.price}`);

  return {
    storeName: store.name,
    storePrice: parsed.price,
    productName: parsed.name,
    productUrl: cleanUrl,
    currency: "USD",
    brand: parsed.brand,
  };
}
