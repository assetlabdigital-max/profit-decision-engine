/**
 * src/lib/retail/amazon-match.ts
 *
 * NODE RUNTIME ONLY. Searches Amazon catalog for a product by name
 * and returns the best matching ASIN.
 */

import { spApiCall, isAmazonEnabled } from "@/lib/amazon/client";

export interface AmazonMatch {
  asin: string;
  title: string;
  confidence: "high" | "medium" | "low";
}

export async function findAmazonMatch(productName: string): Promise<AmazonMatch | null> {
  if (!isAmazonEnabled()) return null;

  try {
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER";

    // Clean up product name for better search results
    const query = productName
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);

    console.log(`[amazon-match] searching for: "${query}"`);

    const data = await spApiCall<any>(
      `/catalog/2022-04-01/items?keywords=${encodeURIComponent(query)}&marketplaceIds=${marketplaceId}&includedData=summaries&pageSize=5`
    );

    const items = data?.items ?? [];
    if (items.length === 0) {
      console.warn(`[amazon-match] no results for "${query}"`);
      return null;
    }

    const first = items[0];
    const asin = first?.asin;
    const title = first?.summaries?.[0]?.itemName ?? "Unknown";

    if (!asin) return null;

    console.log(`[amazon-match] best match: ASIN=${asin}, title="${title}"`);

    return {
      asin,
      title,
      confidence: items.length === 1 ? "high" : "medium",
    };
  } catch (err) {
    console.error("[amazon-match] search failed:", err);
    return null;
  }
}