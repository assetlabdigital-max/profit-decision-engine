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

type ParsedRetail = { name: string; price: number; brand?: string };

type StoreConfig = {
  name: string;
  actorId: string;
  buildInputs: (url: string) => Record<string, unknown>[];
  pickItem: (items: Record<string, unknown>[], url: string) => Record<string, unknown> | null;
  parser: (item: Record<string, unknown>) => ParsedRetail | null;
};

const APIFY_TIMEOUT_SECS = 120;

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
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

/** Costco /p/-/slug/1234567 → human-readable search terms */
export function costcoSearchQueryFromUrl(url: string): string | null {
  const modern = url.match(/costco\.com\/p\/-\/([^/]+)\/(\d+)/i);
  if (modern) {
    return modern[1].replace(/-/g, " ").replace(/\s+/g, " ").trim();
  }

  const legacy = url.match(/costco\.com\/([^/?]+)\.product\.(\d+)/i);
  if (legacy) {
    return legacy[1].replace(/-/g, " ").replace(/\s+/g, " ").trim();
  }

  const trailingId = url.match(/\/(\d{5,})\/?$/);
  if (trailingId) return trailingId[1];

  return null;
}

export function costcoItemNumberFromUrl(url: string): string | null {
  const match = url.match(/\/(\d{5,})\/?(?:\?|#|$)/);
  return match ? match[1] : null;
}

function parseCostcoItem(item: Record<string, unknown>): ParsedRetail | null {
  const name = parseName(item.name, item.title, item.productName);
  const price = parsePrice(item.memberPrice, item.onlinePrice, item.price, item.salePrice);
  const brand = parseName(item.brand) || undefined;
  if (!name || price == null) return null;
  return { name, price, brand };
}

function pickCostcoItem(items: Record<string, unknown>[], url: string): Record<string, unknown> | null {
  if (items.length === 0) return null;
  const itemNumber = costcoItemNumberFromUrl(url);
  if (itemNumber) {
    const exact = items.find((item) => String(item.itemNumber ?? "") === itemNumber);
    if (exact) return exact;
    const urlMatch = items.find((item) => {
      const productUrl = String(item.productUrl ?? "");
      return productUrl.includes(itemNumber);
    });
    if (urlMatch) return urlMatch;
  }
  return items[0];
}

const STORE_CONFIGS: StoreConfig[] = [
  {
    name: "Costco",
    actorId: "parseforge~costco-scraper",
    buildInputs: (url) => {
      const inputs: Record<string, unknown>[] = [];
      const searchQuery = costcoSearchQueryFromUrl(url);

      // /p/-/slug/id URLs often fail on direct startUrls — search first
      if (searchQuery) {
        inputs.push({ maxItems: 10, searchQuery, proxyConfiguration: RESIDENTIAL_PROXY });
        inputs.push({ maxItems: 10, searchQuery, proxyConfiguration: { useApifyProxy: true } });
      }

      inputs.push(
        { maxItems: 5, startUrls: [url], proxyConfiguration: RESIDENTIAL_PROXY },
        { maxItems: 5, startUrls: [{ url }], proxyConfiguration: RESIDENTIAL_PROXY },
        { maxItems: 5, startUrls: [url], proxyConfiguration: { useApifyProxy: true } }
      );

      return inputs;
    },
    pickItem: pickCostcoItem,
    parser: parseCostcoItem,
  },
  {
    name: "Walmart",
    actorId: "silentflow~walmart-scraper",
    buildInputs: (url) => [
      {
        urls: [{ url }],
        maxItems: 1,
        includeDetails: true,
        proxyConfiguration: RESIDENTIAL_PROXY,
      },
    ],
    pickItem: (items) => items[0] ?? null,
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
    buildInputs: (url) => [
      { maxItems: 1, startUrls: [url], includeDetails: true, proxyConfiguration: RESIDENTIAL_PROXY },
      { maxItems: 1, startUrls: [{ url }], includeDetails: true, proxyConfiguration: RESIDENTIAL_PROXY },
    ],
    pickItem: (items) => items[0] ?? null,
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
    buildInputs: (url) => [{ maxItems: 1, startUrls: [{ url }] }],
    pickItem: (items) => items[0] ?? null,
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

  const inputs = store.buildInputs(cleanUrl);

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    console.log(`[retail/scraper] ${store.name} attempt ${i + 1}/${inputs.length}`);

    const run = await runApifyActor<Record<string, unknown>>(store.actorId, input, {
      timeoutSecs: APIFY_TIMEOUT_SECS,
    });

    if (!run.ok) {
      console.error(`[retail/scraper] Apify attempt ${i + 1} failed for ${store.name}:`, run.error);
      continue;
    }

    const item = store.pickItem(run.items, cleanUrl);
    if (!item) {
      console.warn(`[retail/scraper] attempt ${i + 1}: no matching item for ${store.name}`);
      continue;
    }

    const parsed = store.parser(item);
    if (!parsed) {
      console.warn(
        `[retail/scraper] attempt ${i + 1}: parse failed for ${store.name}:`,
        JSON.stringify(item).slice(0, 400)
      );
      continue;
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

  console.error(`[retail/scraper] all ${inputs.length} attempt(s) failed for ${store.name}`);
  return null;
}
