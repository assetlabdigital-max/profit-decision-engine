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

type ScrapeAttempt = {
  actorId: string;
  input: Record<string, unknown>;
  label: string;
};

type StoreConfig = {
  name: string;
  buildAttempts: (url: string) => ScrapeAttempt[];
  pickItem: (items: Record<string, unknown>[], url: string) => Record<string, unknown> | null;
  parser: (item: Record<string, unknown>) => ParsedRetail | null;
};

const APIFY_TIMEOUT_SECS = 90;

const RESIDENTIAL_PROXY = {
  useApifyProxy: true,
  apifyProxyGroups: ["RESIDENTIAL"],
};

const WALMART_EXTRACTOR = "khadinakbar~walmart-data-extractor";

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

/** Walmart /ip/slug/588046255 or /ip/588046255 */
export function walmartItemIdFromUrl(url: string): string | null {
  const match = url.match(/walmart\.com\/ip\/(?:[^/]+\/)?(\d+)/i);
  return match ? match[1] : null;
}

export function walmartSearchQueryFromUrl(url: string): string | null {
  const slugMatch = url.match(/walmart\.com\/ip\/([^/]+)\/(\d+)/i);
  if (slugMatch && !/^\d+$/.test(slugMatch[1])) {
    return slugMatch[1].replace(/-/g, " ").replace(/\s+/g, " ").trim();
  }
  return null;
}

function parseCostcoItem(item: Record<string, unknown>): ParsedRetail | null {
  const name = parseName(item.name, item.title, item.productName);
  const price = parsePrice(item.memberPrice, item.onlinePrice, item.price, item.salePrice);
  const brand = parseName(item.brand) || undefined;
  if (!name || price == null) return null;
  return { name, price, brand };
}

function parseWalmartItem(item: Record<string, unknown>): ParsedRetail | null {
  const name = parseName(item.name, item.title, item.productTitle);
  const price = parsePrice(
    item.price,
    item.currentPrice,
    item.priceString,
    item.salePrice,
    item.currentPriceString,
    item.minPrice
  );
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

function pickWalmartItem(items: Record<string, unknown>[], url: string): Record<string, unknown> | null {
  if (items.length === 0) return null;
  const itemId = walmartItemIdFromUrl(url);
  if (itemId) {
    const exact = items.find((item) => {
      const id = String(item.itemId ?? item.usItemId ?? item.id ?? "");
      return id === itemId;
    });
    if (exact) return exact;
    const urlMatch = items.find((item) => String(item.url ?? item.productUrl ?? "").includes(itemId));
    if (urlMatch) return urlMatch;
  }
  return items[0];
}

function buildWalmartAttempts(url: string): ScrapeAttempt[] {
  const attempts: ScrapeAttempt[] = [];
  const itemId = walmartItemIdFromUrl(url);
  const searchQuery = walmartSearchQueryFromUrl(url);

  // itemIds is the most reliable path — try it alone first to stay within Vercel limits
  if (itemId) {
    attempts.push({
      actorId: WALMART_EXTRACTOR,
      label: "extractor-itemIds",
      input: {
        mode: "itemIds",
        itemIds: [itemId],
        maxProducts: 1,
        proxyConfiguration: RESIDENTIAL_PROXY,
      },
    });
  }

  // One search fallback if itemIds fails (slug from /ip/name/id)
  if (searchQuery) {
    attempts.push({
      actorId: WALMART_EXTRACTOR,
      label: "extractor-search",
      input: {
        mode: "search",
        searchQuery,
        maxProducts: 3,
        proxyConfiguration: RESIDENTIAL_PROXY,
      },
    });
  }

  return attempts;
}

const STORE_CONFIGS: StoreConfig[] = [
  {
    name: "Costco",
    buildAttempts: (url) => {
      const attempts: ScrapeAttempt[] = [];
      const searchQuery = costcoSearchQueryFromUrl(url);

      if (searchQuery) {
        attempts.push(
          {
            actorId: "parseforge~costco-scraper",
            label: "search-residential",
            input: { maxItems: 10, searchQuery, proxyConfiguration: RESIDENTIAL_PROXY },
          },
          {
            actorId: "parseforge~costco-scraper",
            label: "search-basic-proxy",
            input: { maxItems: 10, searchQuery, proxyConfiguration: { useApifyProxy: true } },
          }
        );
      }

      attempts.push(
        {
          actorId: "parseforge~costco-scraper",
          label: "startUrls-string",
          input: { maxItems: 5, startUrls: [url], proxyConfiguration: RESIDENTIAL_PROXY },
        },
        {
          actorId: "parseforge~costco-scraper",
          label: "startUrls-object",
          input: { maxItems: 5, startUrls: [{ url }], proxyConfiguration: RESIDENTIAL_PROXY },
        },
        {
          actorId: "parseforge~costco-scraper",
          label: "startUrls-basic-proxy",
          input: { maxItems: 5, startUrls: [url], proxyConfiguration: { useApifyProxy: true } },
        }
      );

      return attempts;
    },
    pickItem: pickCostcoItem,
    parser: parseCostcoItem,
  },
  {
    name: "Walmart",
    buildAttempts: buildWalmartAttempts,
    pickItem: pickWalmartItem,
    parser: parseWalmartItem,
  },
  {
    name: "Target",
    buildAttempts: (url) => [
      {
        actorId: "parseforge~target-scraper",
        label: "startUrls-string",
        input: { maxItems: 1, startUrls: [url], includeDetails: true, proxyConfiguration: RESIDENTIAL_PROXY },
      },
      {
        actorId: "parseforge~target-scraper",
        label: "startUrls-object",
        input: { maxItems: 1, startUrls: [{ url }], includeDetails: true, proxyConfiguration: RESIDENTIAL_PROXY },
      },
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
    buildAttempts: (url) => [
      {
        actorId: "kawsar~sam-s-club-product-scraper",
        label: "startUrls",
        input: { maxItems: 1, startUrls: [{ url }] },
      },
    ],
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

  const attempts = store.buildAttempts(cleanUrl);

  for (let i = 0; i < attempts.length; i++) {
    const { actorId, input, label } = attempts[i];
    console.log(`[retail/scraper] ${store.name} attempt ${i + 1}/${attempts.length} (${label})`);

    const run = await runApifyActor<Record<string, unknown>>(actorId, input, {
      timeoutSecs: i === 0 ? APIFY_TIMEOUT_SECS : 60,
    });

    if (!run.ok) {
      console.error(`[retail/scraper] ${label} failed for ${store.name}:`, run.error);
      continue;
    }

    const item = store.pickItem(run.items, cleanUrl);
    if (!item) {
      console.warn(`[retail/scraper] ${label}: no matching item for ${store.name}`);
      continue;
    }

    const parsed = store.parser(item);
    if (!parsed) {
      console.warn(
        `[retail/scraper] ${label}: parse failed for ${store.name}:`,
        JSON.stringify(item).slice(0, 400)
      );
      continue;
    }

    console.log(`[retail/scraper] ${store.name} via ${label}: name="${parsed.name}", price=${parsed.price}`);

    return {
      storeName: store.name,
      storePrice: parsed.price,
      productName: parsed.name,
      productUrl: cleanUrl,
      currency: "USD",
      brand: parsed.brand,
    };
  }

  console.error(`[retail/scraper] all ${attempts.length} attempt(s) failed for ${store.name}`);
  return null;
}
