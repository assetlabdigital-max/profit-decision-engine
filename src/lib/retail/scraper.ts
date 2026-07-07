/**
 * src/lib/retail/scraper.ts
 *
 * NODE RUNTIME ONLY. Detects retail store from URL and scrapes
 * product name + price using Apify actors.
 */

import { runApifyActor, isApifyUsageLimitExceeded } from "@/lib/apify/client";
import { scrapeWalgreensDirect, scrapeJsonLdDirect, scrapeProductDirect } from "@/lib/retail/direct-scrape";
import { getCachedRetailProduct, setCachedRetailProduct } from "@/lib/retail/cache";
import { encodeWalgreensProductUrl, walgreensProdIdFromUrl } from "@/lib/retail/stores";
import type { RetailProduct } from "@/lib/retail/types";

export type { RetailProduct } from "@/lib/retail/types";
export { isRetailUrl } from "@/lib/retail/stores";
export { encodeWalgreensProductUrl, walgreensProdIdFromUrl } from "@/lib/retail/stores";

type ParsedRetail = { name: string; price: number; brand?: string };

type ScrapeAttempt = {
  actorId: string;
  input: Record<string, unknown>;
  label: string;
};

type StoreConfig = {
  name: string;
  domains: string[];
  directScrape?: (url: string) => Promise<RetailProduct | null>;
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
const ECOMMERCE_TOOL = "apify~e-commerce-scraping-tool";

function buildEcommerceToolAttempt(url: string): ScrapeAttempt {
  return {
    actorId: ECOMMERCE_TOOL,
    label: "ecommerce-detailsUrls",
    input: {
      scrapeMode: "AUTO",
      detailsUrls: [{ url }],
      maxProductResults: 1,
      additionalProperties: false,
    },
  };
}

function buildWebScraperJsonLdAttempt(url: string): ScrapeAttempt {
  return {
    actorId: "apify~web-scraper",
    label: "web-scraper-jsonld",
    input: {
      startUrls: [{ url }],
      maxRequestsPerCrawl: 1,
      maxConcurrency: 1,
      injectJQuery: true,
      proxyConfiguration: RESIDENTIAL_PROXY,
      pageFunction: `async function pageFunction(context) {
        const $ = context.jQuery;
        const scripts = $('script[type="application/ld+json"]');
        for (let i = 0; i < scripts.length; i++) {
          try {
            const parsed = JSON.parse($(scripts[i]).html() || 'null');
            const blocks = Array.isArray(parsed) ? parsed : [parsed];
            for (const block of blocks) {
              if (!block) continue;
              const type = block['@type'];
              const types = Array.isArray(type) ? type : type ? [type] : [];
              const nodes = types.some((t) => String(t).toLowerCase() === 'product')
                ? [block]
                : Array.isArray(block['@graph'])
                  ? block['@graph'].filter((n) => {
                      const nt = n && n['@type'];
                      const nts = Array.isArray(nt) ? nt : nt ? [nt] : [];
                      return nts.some((t) => String(t).toLowerCase() === 'product');
                    })
                  : [];
              for (const node of nodes) {
                const offers = node.offers;
                const offer = Array.isArray(offers) ? offers[0] : offers;
                const rawPrice = offer && (offer.price || offer.lowPrice || offer.highPrice);
                const price = rawPrice != null ? parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) : null;
                const name = node.name || node.title || '';
                const brand = typeof node.brand === 'string' ? node.brand : node.brand && node.brand.name;
                if (name && price > 0) return { productName: String(name).trim(), price, brand };
              }
            }
          } catch (_) {}
        }
        const og = $('meta[property="og:title"]').attr('content') || '';
        const h1 = $('h1').first().text().trim();
        const title = (og.split('|')[0] || h1 || '').trim();
        const bodyHtml = $('body').html() || '';
        const single = bodyHtml.match(/1\\/\\$(\\d+(?:\\.\\d{2})?)/i);
        const plain = bodyHtml.match(/\\$(\\d+\\.\\d{2})/);
        const price = single ? parseFloat(single[1]) : plain ? parseFloat(plain[1]) : null;
        if (!title || !price) return null;
        return { productName: title, price };
      }`,
    },
  };
}

function buildWalgreensWebScraperAttempt(url: string): ScrapeAttempt {
  const encoded = encodeWalgreensProductUrl(url);
  const attempt = buildWebScraperJsonLdAttempt(encoded);
  return { ...attempt, label: "walgreens-web-scraper" };
}

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

function parseUniversalItem(item: Record<string, unknown>): ParsedRetail | null {
  const product = item.product as Record<string, unknown> | undefined;
  const offers = item.offers as Record<string, unknown> | undefined;
  const priceObj = item.price as Record<string, unknown> | undefined;
  const priceValue =
    priceObj && typeof priceObj.value === "number" ? priceObj.value : null;
  const name = parseName(
    item.productName,
    item.title,
    item.Title,
    item.name,
    item.product_name,
    item.productDisplayName,
    product?.title
  );
  const price = parsePrice(
    item.price,
    item.storePrice,
    priceValue,
    offers?.price,
    priceObj?.discounted_price,
    priceObj?.regular_price,
    item.currentPrice,
    item.salePrice,
    item.regularPrice,
    item.Sale_Price,
    item.Regular_Price,
    item.member_price,
    product?.price
  );
  const brandRaw = item.brand ?? item.Brand;
  const brand =
    typeof brandRaw === "string"
      ? parseName(brandRaw)
      : parseName((brandRaw as Record<string, unknown> | undefined)?.name) || undefined;
  if (!name || price == null) return null;
  return { name, price, brand: brand || undefined };
}

function parseCostcoItem(item: Record<string, unknown>): ParsedRetail | null {
  return (
    parseUniversalItem(item) ??
    (() => {
      const name = parseName(item.name, item.title, item.productName);
      const price = parsePrice(item.memberPrice, item.onlinePrice, item.price, item.salePrice);
      const brand = parseName(item.brand) || undefined;
      if (!name || price == null) return null;
      return { name, price, brand };
    })()
  );
}

function parseWalmartItem(item: Record<string, unknown>): ParsedRetail | null {
  return (
    parseUniversalItem(item) ??
    (() => {
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
    })()
  );
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

function pickUrlMatchedItem(
  items: Record<string, unknown>[],
  url: string
): Record<string, unknown> | null {
  if (items.length === 0) return null;
  const pathKey = url.replace(/^https?:\/\/[^/]+/i, "").split("?")[0].toLowerCase();
  const matched = items.find((item) => {
    const itemUrl = String(item.url ?? item.productUrl ?? item.productURL ?? "").toLowerCase();
    if (!itemUrl) return false;
    const itemPath = itemUrl.replace(/^https?:\/\/[^/]+/i, "").split("?")[0];
    return itemPath.includes(pathKey) || pathKey.includes(itemPath);
  });
  return matched ?? items[0];
}

function pickWalgreensItem(
  items: Record<string, unknown>[],
  url: string
): Record<string, unknown> | null {
  if (items.length === 0) return null;
  const prodId = walgreensProdIdFromUrl(url);
  if (prodId) {
    const exact = items.find((item) => {
      const id = String(item.prodId ?? item.Product_Id ?? "").toLowerCase();
      const productUrl = String(item.productURL ?? item.productUrl ?? "").toLowerCase();
      return id === prodId || productUrl.includes(prodId);
    });
    if (exact) return exact;
  }
  return items[0];
}

function buildWalmartAttempts(url: string): ScrapeAttempt[] {
  const attempts: ScrapeAttempt[] = [];
  const itemId = walmartItemIdFromUrl(url);
  const searchQuery = walmartSearchQueryFromUrl(url);

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

function newStoreAttempts(url: string): ScrapeAttempt[] {
  return [buildEcommerceToolAttempt(url), buildWebScraperJsonLdAttempt(url)];
}

const STORE_CONFIGS: StoreConfig[] = [
  {
    name: "Costco",
    domains: ["costco.com"],
    directScrape: (url) => scrapeProductDirect(url, "Costco"),
    buildAttempts: (url) => {
      const attempts: ScrapeAttempt[] = [];
      const searchQuery = costcoSearchQueryFromUrl(url);

      if (searchQuery) {
        attempts.push({
          actorId: "parseforge~costco-scraper",
          label: "search-residential",
          input: { maxItems: 10, searchQuery, proxyConfiguration: RESIDENTIAL_PROXY },
        });
      }

      attempts.push({
        actorId: "parseforge~costco-scraper",
        label: "startUrls-object",
        input: { maxItems: 5, startUrls: [{ url }], proxyConfiguration: RESIDENTIAL_PROXY },
      });

      return attempts;
    },
    pickItem: pickCostcoItem,
    parser: parseCostcoItem,
  },
  {
    name: "Walmart",
    domains: ["walmart.com"],
    directScrape: (url) => scrapeProductDirect(url, "Walmart"),
    buildAttempts: buildWalmartAttempts,
    pickItem: pickWalmartItem,
    parser: parseWalmartItem,
  },
  {
    name: "Target",
    domains: ["target.com"],
    directScrape: (url) => scrapeProductDirect(url, "Target"),
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
    parser: (item) => parseUniversalItem(item) ?? null,
  },
  {
    name: "Sam's Club",
    domains: ["samsclub.com"],
    directScrape: (url) => scrapeProductDirect(url, "Sam's Club"),
    buildAttempts: (url) => [
      {
        actorId: "kawsar~sam-s-club-product-scraper",
        label: "startUrls",
        input: { maxItems: 1, startUrls: [{ url }], proxyConfiguration: RESIDENTIAL_PROXY },
      },
      ...newStoreAttempts(url),
    ],
    pickItem: pickUrlMatchedItem,
    parser: parseUniversalItem,
  },
  {
    name: "Walgreens",
    domains: ["walgreens.com"],
    directScrape: scrapeWalgreensDirect,
    buildAttempts: (url) => [
      buildWalgreensWebScraperAttempt(url),
      buildEcommerceToolAttempt(encodeWalgreensProductUrl(url)),
    ],
    pickItem: pickWalgreensItem,
    parser: parseUniversalItem,
  },
  {
    name: "CVS",
    domains: ["cvs.com"],
    directScrape: (url) => scrapeProductDirect(url, "CVS"),
    buildAttempts: newStoreAttempts,
    pickItem: pickUrlMatchedItem,
    parser: parseUniversalItem,
  },
  {
    name: "Ulta",
    domains: ["ulta.com"],
    directScrape: (url) => scrapeProductDirect(url, "Ulta"),
    buildAttempts: newStoreAttempts,
    pickItem: pickUrlMatchedItem,
    parser: parseUniversalItem,
  },
  {
    name: "Home Depot",
    domains: ["homedepot.com"],
    directScrape: (url) => scrapeProductDirect(url, "Home Depot"),
    buildAttempts: newStoreAttempts,
    pickItem: pickUrlMatchedItem,
    parser: parseUniversalItem,
  },
  {
    name: "Best Buy",
    domains: ["bestbuy.com"],
    directScrape: (url) => scrapeProductDirect(url, "Best Buy"),
    buildAttempts: newStoreAttempts,
    pickItem: pickUrlMatchedItem,
    parser: parseUniversalItem,
  },
];

function detectStore(url: string): StoreConfig | null {
  const lower = url.toLowerCase();
  return STORE_CONFIGS.find((store) => store.domains.some((domain) => lower.includes(domain))) ?? null;
}

let lastRetailScrapeError: string | null = null;

export function getLastRetailScrapeError(): string | null {
  return lastRetailScrapeError;
}

function isApifyUsageLimitError(error: string): boolean {
  return error.includes("usage hard limit") || error.includes("platform-feature-disabled");
}

function parseItem(
  item: Record<string, unknown>,
  storeParser: (item: Record<string, unknown>) => ParsedRetail | null
): ParsedRetail | null {
  return parseUniversalItem(item) ?? storeParser(item);
}

async function finalizeRetailProduct(product: RetailProduct): Promise<RetailProduct> {
  await setCachedRetailProduct(product).catch((err) => {
    console.warn("[retail/scraper] cache write failed (non-fatal):", err);
  });
  return product;
}

export async function scrapeRetailProduct(url: string): Promise<RetailProduct | null> {
  const cleanUrl = normalizeRetailUrl(url);
  const store = detectStore(cleanUrl);
  if (!store) {
    console.warn("[retail/scraper] unsupported store URL:", url);
    return null;
  }

  console.log(`[retail/scraper] scraping ${store.name} URL: ${cleanUrl}`);
  lastRetailScrapeError = null;

  const cached = await getCachedRetailProduct(cleanUrl);
  if (cached?.product) {
    console.log(`[retail/scraper] cache hit for ${store.name}: "${cached.product.productName}"`);
    return cached.product;
  }

  if (store.directScrape) {
    const direct = await store.directScrape(cleanUrl);
    if (direct) return finalizeRetailProduct(direct);
  }

  const jsonLdEarly = await scrapeJsonLdDirect(cleanUrl, store.name);
  if (jsonLdEarly) return finalizeRetailProduct(jsonLdEarly);

  if (isApifyUsageLimitExceeded()) {
    lastRetailScrapeError = "Apify monthly usage hard limit exceeded";
    console.warn(`[retail/scraper] Apify quota exhausted — skipping Apify for ${store.name}`);
    return null;
  }

  const attempts = store.buildAttempts(cleanUrl);

  for (let i = 0; i < attempts.length; i++) {
    const { actorId, input, label } = attempts[i];
    console.log(`[retail/scraper] ${store.name} attempt ${i + 1}/${attempts.length} (${label})`);

    const run = await runApifyActor<Record<string, unknown>>(actorId, input, {
      timeoutSecs: i === 0 ? APIFY_TIMEOUT_SECS : 60,
    });

    if (!run.ok) {
      lastRetailScrapeError = run.error;
      console.error(`[retail/scraper] ${label} failed for ${store.name}:`, run.error);
      if (isApifyUsageLimitError(run.error)) {
        console.warn(`[retail/scraper] Apify quota exhausted — skipping remaining Apify attempts for ${store.name}`);
        break;
      }
      continue;
    }

    const primary = store.pickItem(run.items, cleanUrl);
    const candidates: Record<string, unknown>[] = [];
    if (primary) candidates.push(primary);
    for (const item of run.items) {
      if (item && item !== primary) candidates.push(item);
    }

    for (const item of candidates) {
      const parsed = parseItem(item, store.parser);
      if (!parsed) continue;

      console.log(
        `[retail/scraper] ${store.name} via ${label}: name="${parsed.name}", price=${parsed.price}`
      );

      return finalizeRetailProduct({
        storeName: store.name,
        storePrice: parsed.price,
        productName: parsed.name,
        productUrl: cleanUrl,
        currency: "USD",
        brand: parsed.brand,
      });
    }

    console.warn(
      `[retail/scraper] ${label}: no parseable item for ${store.name} (${run.items.length} raw item(s))`
    );
  }

  const jsonLd = await scrapeJsonLdDirect(cleanUrl, store.name);
  if (jsonLd) return finalizeRetailProduct(jsonLd);

  console.error(`[retail/scraper] all ${attempts.length} attempt(s) failed for ${store.name}`);
  if (!lastRetailScrapeError) {
    lastRetailScrapeError = "No store product data could be parsed from any scrape attempt.";
  }
  return null;
}
