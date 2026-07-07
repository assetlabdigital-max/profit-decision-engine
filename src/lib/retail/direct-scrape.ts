/**
 * Lightweight direct HTTP scrapers for retailers when Apify actors fail.
 * NODE RUNTIME ONLY.
 */

import type { RetailProduct } from "@/lib/retail/types";
import { encodeWalgreensProductUrl } from "@/lib/retail/stores";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseUsd(...candidates: (string | undefined)[]): number | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = candidate.match(/(\d+(?:\.\d{2})?)/);
    if (!match) continue;
    const numeric = Number(match[1]);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

function metaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`property="${property}"[^>]*content="([^"]+)"`, "i"),
    new RegExp(`content="([^"]+)"[^>]*property="${property}"`, "i"),
    new RegExp(`name="${property}"[^>]*content="([^"]+)"`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function extractProductsFromJsonLd(block: unknown): Array<Record<string, unknown>> {
  if (!block || typeof block !== "object") return [];
  const record = block as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type : type ? [type] : [];

  if (types.some((t) => String(t).toLowerCase() === "product")) {
    return [record];
  }

  if (Array.isArray(record["@graph"])) {
    return (record["@graph"] as unknown[])
      .filter((node) => {
        if (!node || typeof node !== "object") return false;
        const nodeType = (node as Record<string, unknown>)["@type"];
        const nodeTypes = Array.isArray(nodeType) ? nodeType : nodeType ? [nodeType] : [];
        return nodeTypes.some((t) => String(t).toLowerCase() === "product");
      })
      .map((node) => node as Record<string, unknown>);
  }

  return [];
}

function priceFromOffers(offers: unknown): number | null {
  if (!offers) return null;
  if (Array.isArray(offers)) {
    for (const offer of offers) {
      const price = priceFromOffers(offer);
      if (price != null) return price;
    }
    return null;
  }
  if (typeof offers !== "object") return null;
  const offer = offers as Record<string, unknown>;
  const raw = offer.price ?? offer.lowPrice ?? offer.highPrice;
  if (typeof raw === "number" && raw > 0) return raw;
  if (typeof raw === "string") return parseUsd(raw) ?? null;
  return null;
}

function parseJsonLdProduct(
  product: Record<string, unknown>
): { name: string; price: number; brand?: string } | null {
  const name =
    typeof product.name === "string"
      ? product.name.trim()
      : typeof product.title === "string"
        ? product.title.trim()
        : "";
  const price = priceFromOffers(product.offers);
  const brandRaw = product.brand;
  const brand =
    typeof brandRaw === "string"
      ? brandRaw.trim()
      : brandRaw && typeof brandRaw === "object" && typeof (brandRaw as Record<string, unknown>).name === "string"
        ? String((brandRaw as Record<string, unknown>).name).trim()
        : undefined;

  if (!name || price == null) return null;
  return { name, price, brand: brand || undefined };
}

/** Parse Schema.org Product JSON-LD from a public product page. */
export async function scrapeJsonLdDirect(
  url: string,
  storeName: string
): Promise<RetailProduct | null> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[retail/direct] ${storeName} JSON-LD HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];

    for (const match of scripts) {
      const raw = match[1]?.trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as unknown;
        const blocks = Array.isArray(parsed) ? parsed : [parsed];
        for (const block of blocks) {
          for (const product of extractProductsFromJsonLd(block)) {
            const extracted = parseJsonLdProduct(product);
            if (!extracted) continue;
            console.log(
              `[retail/direct] ${storeName} JSON-LD: name="${extracted.name}", price=${extracted.price}`
            );
            return {
              storeName,
              storePrice: extracted.price,
              productName: extracted.name,
              productUrl: url,
              currency: "USD",
              brand: extracted.brand,
            };
          }
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn(`[retail/direct] ${storeName} JSON-LD fetch failed:`, message);
    return null;
  }
}

/** Generic direct scrape: JSON-LD first, then Open Graph / meta fallbacks. */
export async function scrapeProductDirect(
  url: string,
  storeName: string
): Promise<RetailProduct | null> {
  const jsonLd = await scrapeJsonLdDirect(url, storeName);
  if (jsonLd) return jsonLd;

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const html = await response.text();
    const ogTitle = metaContent(html, "og:title");
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    const productName = stripTags(ogTitle?.split("|")[0] ?? h1 ?? "");

    const ogPrice = metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount");
    const priceMatch = html.match(/"price"\s*:\s*"?(\d+(?:\.\d{2})?)"?/i)?.[1];
    const storePrice = parseUsd(ogPrice ?? undefined, priceMatch);

    if (!productName || storePrice == null) return null;

    console.log(`[retail/direct] ${storeName} meta: name="${productName}", price=${storePrice}`);

    return {
      storeName,
      storePrice,
      productName,
      productUrl: url,
      currency: "USD",
    };
  } catch {
    return null;
  }
}

export async function scrapeWalgreensDirect(url: string): Promise<RetailProduct | null> {
  const productUrl = encodeWalgreensProductUrl(url);
  const jsonLd = await scrapeJsonLdDirect(productUrl, "Walgreens");
  if (jsonLd) return jsonLd;

  try {
    const response = await fetch(productUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[retail/direct] Walgreens HTTP ${response.status} for ${productUrl}`);
      return null;
    }

    const html = await response.text();
    const ogTitle = metaContent(html, "og:title");
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    const productName = stripTags(ogTitle?.split("|")[0] ?? h1 ?? "");

    const singleUnit = html.match(/1\/\$(\d+(?:\.\d{2})?)/i)?.[1];
    const regularPrice = html.match(/"regularPrice"\s*:\s*"\$?(\d+(?:\.\d{2})?)"/i)?.[1];
    const salePrice = html.match(/"salePrice"\s*:\s*"\$?(\d+(?:\.\d{2})?)"/i)?.[1];
    const priceText = html.match(/\$(\d+\.\d{2})\s*(?:\/|<)/i)?.[1];
    const storePrice = parseUsd(singleUnit, salePrice, regularPrice, priceText);

    if (!productName || storePrice == null) {
      console.warn("[retail/direct] Walgreens parse incomplete:", { productName, storePrice });
      return null;
    }

    const brand = /nice!/i.test(productName) ? "Nice!" : undefined;

    console.log(`[retail/direct] Walgreens: name="${productName}", price=${storePrice}`);

    return {
      storeName: "Walgreens",
      storePrice,
      productName,
      productUrl,
      currency: "USD",
      brand,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("[retail/direct] Walgreens fetch failed:", message);
    return null;
  }
}
