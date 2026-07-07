/**
 * Lightweight direct HTTP scrapers for retailers when Apify actors fail.
 * NODE RUNTIME ONLY.
 */

import type { RetailProduct } from "@/lib/retail/scraper";
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

export async function scrapeWalgreensDirect(url: string): Promise<RetailProduct | null> {
  const productUrl = encodeWalgreensProductUrl(url);

  try {
    const response = await fetch(productUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(20_000),
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

    console.log(
      `[retail/direct] Walgreens: name="${productName}", price=${storePrice}`
    );

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
