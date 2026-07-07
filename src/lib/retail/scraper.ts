/**
 * src/lib/retail/scraper.ts
 *
 * NODE RUNTIME ONLY. Detects retail store from URL and scrapes
 * product name + price using Apify actors.
 */

import { runApifyActor } from "@/lib/apify/client";
import { encodeWalgreensProductUrl, walgreensProdIdFromUrl } from "@/lib/retail/stores";
import { scrapeWalgreensDirect, scrapeJsonLdDirect } from "@/lib/retail/direct-scrape";

export { isRetailUrl } from "@/lib/retail/stores";
export { encodeWalgreensProductUrl, walgreensProdIdFromUrl } from "@/lib/retail/stores";

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
  domains: string[];
  directScrape?: (url: string) => Promise<RetailProduct | null>;
  maxApifyAttempts?: number;
  buildAttempts: (url: string) => ScrapeAttempt[];
  pickItem: (items: Record<string, unknown>[], url: string) => Record<string, unknown> | null;
  parser: (item: Record<string, unknown>) => ParsedRetail | null;
};

const DEFAULT_MAX_ATTEMPTS = 4;

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

function buildJsonLdWebScraperAttempt(url: string): ScrapeAttempt {
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
        const products = [];
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const parsed = JSON.parse($(el).html() || 'null');
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
                if (name && price > 0) products.push({ productName: String(name).trim(), price, brand });
              }
            }
          } catch (_) {}
        });
        if (products.length > 0) return products[0];
        const og = $('meta[property="og:title"]').attr('content') || '';
        const h1 = $('h1').first().text().trim();
        const title = (og.split('|')[0] || h1 || '').trim();
        const bodyHtml = $('body').html() || '';
        const priceMatch = bodyHtml.match(/\\$(\\d+\\.\\d{2})/);
        const price = priceMatch ? parseFloat(priceMatch[1]) : null;
        if (!title || !price) return null;
        return { productName: title, price };
      }`,
    },
  };
}

function finalizeAttempts(attempts: ScrapeAttempt[], url: string, max?: number): ScrapeAttempt[] {
  const candidates = [
    ...attempts,
    buildEcommerceToolAttempt(url),
    buildJsonLdWebScraperAttempt(url),
  ];
  const seen = new Set<string>();
  return candidates
    .filter((attempt) => {
      if (seen.has(attempt.label)) return false;
      seen.add(attempt.label);
      return true;
    })
    .slice(0, max ?? DEFAULT_MAX_ATTEMPTS);
}

function attemptTimeoutSecs(label: string): number {
  if (
    label.startsWith("target-") ||
    label.startsWith("costco-") ||
    label.includes("extractor") ||
    label.startsWith("sams-")
  ) {
    return 120;
  }
  if (label === "web-scraper-jsonld" || label === "web-scraper-residential") return 90;
  return 80;
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
      const id = String(item.prodId ?? "").toLowerCase();
      const productUrl = String(item.productURL ?? item.productUrl ?? "").toLowerCase();
      return id === prodId || productUrl.includes(prodId);
    });
    if (exact) return exact;
  }
  return items[0];
}

function parseGenericRetailItem(item: Record<string, unknown>): ParsedRetail | null {
  const product = item.product as Record<string, unknown> | undefined;
  const offers = item.offers as Record<string, unknown> | undefined;
  const priceObj = item.price as Record<string, unknown> | undefined;
  const priceValue =
    priceObj && typeof priceObj.value === "number" ? priceObj.value : null;
  const name = parseName(
    item.title,
    item.Title,
    item.name,
    item.product_name,
    item.productName,
    item.productDisplayName,
    product?.title
  );
  const price = parsePrice(
    priceValue,
    typeof item.price === "number" ? item.price : null,
    offers?.price,
    priceObj?.discounted_price,
    priceObj?.regular_price,
    item.price,
    item.currentPrice,
    item.salePrice,
    item.regularPrice,
    item.member_price,
    item.memberPrice,
    product?.price
  );
  const brandRaw = item.brand;
  const brand =
    typeof brandRaw === "string"
      ? parseName(brandRaw)
      : parseName((brandRaw as Record<string, unknown> | undefined)?.name) || undefined;
  if (!name || price == null) return null;
  return { name, price, brand: brand || undefined };
}

function parseWalgreensParserItem(item: Record<string, unknown>): ParsedRetail | null {
  const name = parseName(item.Title, item.title, item.productName, item.productDisplayName);
  const price = parsePrice(
    item.Sale_Price,
    item.Regular_Price,
    item.sale_price,
    item.regular_price,
    item.price
  );
  const brand = parseName(item.Brand, item.brand) || undefined;
  if (!name || price == null) return null;
  return { name, price, brand };
}

function parseWalgreensItem(item: Record<string, unknown>): ParsedRetail | null {
  const priceInfo = item.priceInfo as Record<string, unknown> | undefined;
  const rawUnit = item.unitPrice;
  const unitNumeric =
    typeof rawUnit === "number" ? rawUnit : Number(String(rawUnit ?? "").replace(/[^0-9.]/g, ""));
  const name = parseName(item.productDisplayName, item.productName, item.subBrandName);
  const price = parsePrice(
    priceInfo?.regularPrice,
    priceInfo?.salePrice,
    item.listPrice,
    item.salePrice,
    item.price,
    unitNumeric > 0 && unitNumeric < 1_000_000 ? unitNumeric : null
  );
  const brand = parseName(item.beautyCategoryName, item.subBrandName, item.brand) || undefined;
  if (!name || price == null) return null;
  return { name, price, brand };
}

function parseRetailItem(
  item: Record<string, unknown>,
  storeParser: (item: Record<string, unknown>) => ParsedRetail | null
): ParsedRetail | null {
  return (
    parseGenericRetailItem(item) ??
    parseWebScraperItem(item) ??
    parseWalgreensParserItem(item) ??
    parseWalgreensItem(item) ??
    storeParser(item)
  );
}

function buildWalgreensWebScraperAttempt(url: string): ScrapeAttempt {
  const encoded = encodeWalgreensProductUrl(url);
  return {
    actorId: "apify~web-scraper",
    label: "web-scraper-residential",
    input: {
      startUrls: [{ url: encoded }],
      maxRequestsPerCrawl: 1,
      maxConcurrency: 1,
      injectJQuery: true,
      proxyConfiguration: RESIDENTIAL_PROXY,
      pageFunction: `async function pageFunction(context) {
        const $ = context.jQuery;
        const og = $('meta[property="og:title"]').attr('content') || '';
        const h1 = $('h1').first().text().trim();
        const title = (og.split('|')[0] || h1 || '').trim();
        const bodyHtml = $('body').html() || '';
        const single = bodyHtml.match(/1\\/\\$(\\d+(?:\\.\\d{2})?)/i);
        const plain = bodyHtml.match(/\\$(\\d+\\.\\d{2})(?:\\s*\\/|<)/i);
        const price = single ? parseFloat(single[1]) : plain ? parseFloat(plain[1]) : null;
        if (!title || !price) return null;
        const brand = /nice!/i.test(title) ? 'Nice!' : undefined;
        return { productName: title, price, brand };
      }`,
    },
  };
}

function parseWebScraperItem(item: Record<string, unknown>): ParsedRetail | null {
  const name = parseName(item.productName, item.title, item.name);
  const price = parsePrice(item.price, item.storePrice);
  const brand = parseName(item.brand) || undefined;
  if (!name || price == null) return null;
  return { name, price, brand: brand || undefined };
}

const STORE_CONFIGS: StoreConfig[] = [
  {
    name: "Costco",
    domains: ["costco.com"],
    buildAttempts: (url) => {
      const attempts: ScrapeAttempt[] = [];
      const searchQuery = costcoSearchQueryFromUrl(url);
      if (searchQuery) {
        attempts.push({
          actorId: "parseforge~costco-scraper",
          label: "costco-search",
          input: { maxItems: 5, searchQuery, proxyConfiguration: RESIDENTIAL_PROXY },
        });
      }
      attempts.push({
        actorId: "parseforge~costco-scraper",
        label: "costco-startUrls",
        input: { maxItems: 3, startUrls: [{ url }], proxyConfiguration: RESIDENTIAL_PROXY },
      });
      return attempts;
    },
    pickItem: pickCostcoItem,
    parser: parseCostcoItem,
  },
  {
    name: "Walmart",
    domains: ["walmart.com"],
    buildAttempts: buildWalmartAttempts,
    pickItem: pickWalmartItem,
    parser: parseWalmartItem,
  },
  {
    name: "Target",
    domains: ["target.com"],
    buildAttempts: (url) => [
      {
        actorId: "parseforge~target-scraper",
        label: "target-startUrls",
        input: { maxItems: 1, startUrls: [url], includeDetails: true, proxyConfiguration: RESIDENTIAL_PROXY },
      },
      {
        actorId: "parseforge~target-scraper",
        label: "target-startUrls-object",
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
    domains: ["samsclub.com"],
    buildAttempts: (url) => [
      {
        actorId: "kawsar~sam-s-club-product-scraper",
        label: "sams-startUrls",
        input: { maxItems: 1, startUrls: [{ url }], proxyConfiguration: RESIDENTIAL_PROXY },
      },
    ],
    pickItem: pickUrlMatchedItem,
    parser: (item) => {
      const name = parseName(item.product_name, item.name, item.title);
      const price = parsePrice(item.price, item.member_price, item.original_price);
      const brand = parseName(item.brand) || undefined;
      if (!name || price == null) return null;
      return { name, price, brand };
    },
  },
  {
    name: "Walgreens",
    domains: ["walgreens.com"],
    directScrape: scrapeWalgreensDirect,
    buildAttempts: (url) => [buildWalgreensWebScraperAttempt(url)],
    pickItem: pickWalgreensItem,
    parser: () => null,
  },
  {
    name: "CVS",
    domains: ["cvs.com"],
    buildAttempts: (url) => [
      {
        actorId: "getdataforme~cvs-scraper",
        label: "cvs-urls",
        input: { urls: [url] },
      },
    ],
    pickItem: pickUrlMatchedItem,
    parser: () => null,
  },
  {
    name: "Ulta",
    domains: ["ulta.com"],
    buildAttempts: (url) => [
      {
        actorId: "buseta~ulta-advanced-scraper",
        label: "ulta-product-urls",
        input: { scrape_type: "product", product_urls: [url] },
      },
    ],
    pickItem: pickUrlMatchedItem,
    parser: () => null,
  },
  {
    name: "Home Depot",
    domains: ["homedepot.com"],
    buildAttempts: (url) => [
      {
        actorId: "studio-amba~homedepot-scraper",
        label: "homedepot-categoryUrls",
        input: {
          categoryUrls: [{ url }],
          maxResults: 1,
          proxyConfiguration: RESIDENTIAL_PROXY,
        },
      },
    ],
    pickItem: pickUrlMatchedItem,
    parser: () => null,
  },
  {
    name: "Best Buy",
    domains: ["bestbuy.com"],
    buildAttempts: (url) => [
      {
        actorId: "sovereigntaylor~bestbuy-scraper",
        label: "bestbuy-productUrls",
        input: { productUrls: [url], maxResults: 1 },
      },
    ],
    pickItem: pickUrlMatchedItem,
    parser: () => null,
  },
];

function detectStore(url: string): StoreConfig | null {
  const lower = url.toLowerCase();
  return STORE_CONFIGS.find((store) => store.domains.some((domain) => lower.includes(domain))) ?? null;
}

export async function scrapeRetailProduct(url: string): Promise<RetailProduct | null> {
  const cleanUrl = normalizeRetailUrl(url);
  const store = detectStore(cleanUrl);
  if (!store) {
    console.warn("[retail/scraper] unsupported store URL:", url);
    return null;
  }

  console.log(`[retail/scraper] scraping ${store.name} URL: ${cleanUrl}`);

  if (store.directScrape) {
    const direct = await store.directScrape(cleanUrl);
    if (direct) return direct;
  }

  const attempts = finalizeAttempts(store.buildAttempts(cleanUrl), cleanUrl, store.maxApifyAttempts);

  for (let i = 0; i < attempts.length; i++) {
    const { actorId, input, label } = attempts[i];
    console.log(`[retail/scraper] ${store.name} attempt ${i + 1}/${attempts.length} (${label})`);

    const run = await runApifyActor<Record<string, unknown>>(actorId, input, {
      timeoutSecs: attemptTimeoutSecs(label),
    });

    if (!run.ok) {
      console.error(`[retail/scraper] ${label} failed for ${store.name}:`, run.error);
      continue;
    }

    const primary = store.pickItem(run.items, cleanUrl);
    const orderedItems: Record<string, unknown>[] = [];
    if (primary) orderedItems.push(primary);
    for (const item of run.items) {
      if (item && item !== primary) orderedItems.push(item);
    }

    for (const item of orderedItems) {
      const parsed = parseRetailItem(item, store.parser);
      if (!parsed) {
        continue;
      }

      console.log(
        `[retail/scraper] ${store.name} via ${label}: name="${parsed.name}", price=${parsed.price}`
      );

      return {
        storeName: store.name,
        storePrice: parsed.price,
        productName: parsed.name,
        productUrl: cleanUrl,
        currency: "USD",
        brand: parsed.brand,
      };
    }

    console.warn(
      `[retail/scraper] ${label}: no parseable item for ${store.name} (${run.items.length} raw item(s))`
    );
  }

  const jsonLdDirect = await scrapeJsonLdDirect(cleanUrl, store.name);
  if (jsonLdDirect) return jsonLdDirect;

  console.error(`[retail/scraper] all ${attempts.length} attempt(s) failed for ${store.name}`);
  return null;
}
