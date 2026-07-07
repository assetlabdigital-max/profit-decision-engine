/**
 * DB-backed cache for retail product scrapes (24h TTL).
 * NODE RUNTIME ONLY.
 */

import { createHash } from "crypto";
import { safeQuery } from "@/lib/db/safe-query";
import type { RetailProduct } from "@/lib/retail/types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export async function getCachedRetailProduct(
  productUrl: string
): Promise<{ product: RetailProduct; mock: boolean } | null> {
  const urlHash = hashUrl(productUrl);
  const result = await safeQuery<{
    store_name: string;
    product_name: string;
    store_price: string;
    brand: string | null;
    product_url: string;
    currency: string;
    scraped_at: Date | string;
  }>(
    `select store_name, product_name, store_price, brand, product_url, currency, scraped_at
     from retail_scrape_cache
     where url_hash = $1
     limit 1`,
    [urlHash]
  );

  if (!result.ok || !result.rows[0]) return null;

  const row = result.rows[0];
  const scrapedAt = row.scraped_at instanceof Date ? row.scraped_at : new Date(row.scraped_at);
  if (Date.now() - scrapedAt.getTime() > CACHE_TTL_MS) return null;

  const price = Number(row.store_price);
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    product: {
      storeName: row.store_name,
      storePrice: price,
      productName: row.product_name,
      productUrl: row.product_url,
      currency: row.currency || "USD",
      brand: row.brand ?? undefined,
    },
    mock: false,
  };
}

export async function setCachedRetailProduct(product: RetailProduct): Promise<void> {
  const urlHash = hashUrl(product.productUrl);
  await safeQuery(
    `insert into retail_scrape_cache (
       url_hash, store_name, product_name, store_price, brand, product_url, currency, scraped_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (url_hash) do update set
       store_name = excluded.store_name,
       product_name = excluded.product_name,
       store_price = excluded.store_price,
       brand = excluded.brand,
       product_url = excluded.product_url,
       currency = excluded.currency,
       scraped_at = now()`,
    [
      urlHash,
      product.storeName,
      product.productName,
      product.storePrice,
      product.brand ?? null,
      product.productUrl,
      product.currency || "USD",
    ]
  );
}
