/**
 * src/lib/retail/amazon-match.ts
 *
 * NODE RUNTIME ONLY. Searches Amazon catalog for a product by name
 * and returns the best matching ASIN with overlap-based scoring.
 */

import { spApiCall, isAmazonEnabled } from "@/lib/amazon/client";
import { tokenOverlapScore } from "@/lib/retail/match-quality";

export interface AmazonMatch {
  asin: string;
  title: string;
  confidence: "high" | "medium" | "low";
  overlapScore: number;
}

export async function findAmazonMatch(
  productName: string,
  brand?: string
): Promise<AmazonMatch | null> {
  if (!isAmazonEnabled()) return null;

  try {
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER";

    const rawQuery = [brand?.trim(), productName.trim()].filter(Boolean).join(" ");
    const query = rawQuery
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);

    console.log(`[amazon-match] searching for: "${query}"`);

    const data = await spApiCall<{
      items?: Array<{ asin?: string; summaries?: Array<{ itemName?: string }> }>;
    }>(
      `/catalog/2022-04-01/items?keywords=${encodeURIComponent(query)}&marketplaceIds=${marketplaceId}&includedData=summaries&pageSize=5`
    );

    const items = data?.items ?? [];
    if (items.length === 0) {
      console.warn(`[amazon-match] no results for "${query}"`);
      return null;
    }

    let best: { asin: string; title: string; overlapScore: number } | null = null;

    for (const item of items) {
      const asin = item?.asin;
      const title = item?.summaries?.[0]?.itemName ?? "";
      if (!asin || !title) continue;

      const overlapScore = tokenOverlapScore(productName, title);
      if (!best || overlapScore > best.overlapScore) {
        best = { asin, title, overlapScore };
      }
    }

    if (!best) return null;

    let confidence: AmazonMatch["confidence"] = "low";
    if (best.overlapScore >= 0.5) confidence = "high";
    else if (best.overlapScore >= 0.3) confidence = "medium";

    console.log(
      `[amazon-match] best match: ASIN=${best.asin}, overlap=${best.overlapScore.toFixed(2)}, title="${best.title}"`
    );

    return {
      asin: best.asin,
      title: best.title,
      confidence,
      overlapScore: best.overlapScore,
    };
  } catch (err) {
    console.error("[amazon-match] search failed:", err);
    return null;
  }
}
