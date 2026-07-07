/**
 * src/lib/retail/amazon-match.ts
 *
 * NODE RUNTIME ONLY. Searches Amazon catalog for a product by name
 * and returns the best matching ASIN with overlap + variant scoring.
 */

import { spApiCall, isAmazonEnabled } from "@/lib/amazon/client";
import {
  retailAmazonMatchScore,
  detectVariantMismatch,
  tokenOverlapScore,
} from "@/lib/retail/match-quality";
import { edgeCaseMatchPenalty } from "@/lib/retail/edge-cases";

export interface AmazonMatch {
  asin: string;
  title: string;
  confidence: "high" | "medium" | "low";
  overlapScore: number;
  variantMismatch: boolean;
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
      `/catalog/2022-04-01/items?keywords=${encodeURIComponent(query)}&marketplaceIds=${marketplaceId}&includedData=summaries&pageSize=10`
    );

    const items = data?.items ?? [];
    if (items.length === 0) {
      console.warn(`[amazon-match] no results for "${query}"`);
      return null;
    }

    let best: {
      asin: string;
      title: string;
      overlapScore: number;
      matchScore: number;
      variantMismatch: boolean;
    } | null = null;

    for (const item of items) {
      const asin = item?.asin;
      const title = item?.summaries?.[0]?.itemName ?? "";
      if (!asin || !title) continue;

      const overlapScore = tokenOverlapScore(productName, title);
      const matchScore = retailAmazonMatchScore(productName, title);
      const variantMismatch = detectVariantMismatch(productName, title).mismatched;
      const edgePenalty = edgeCaseMatchPenalty(productName, title);

      if (edgePenalty < 0.12) continue;

      if (!best || matchScore > best.matchScore) {
        best = { asin, title, overlapScore, matchScore, variantMismatch };
      }
    }

    if (!best) return null;

    let confidence: AmazonMatch["confidence"] = "low";
    if (!best.variantMismatch && best.overlapScore >= 0.55) confidence = "high";
    else if (!best.variantMismatch && best.overlapScore >= 0.35) confidence = "medium";

    console.log(
      `[amazon-match] best: ASIN=${best.asin}, overlap=${best.overlapScore.toFixed(2)}, variantMismatch=${best.variantMismatch}, title="${best.title}"`
    );

    return {
      asin: best.asin,
      title: best.title,
      confidence,
      overlapScore: best.overlapScore,
      variantMismatch: best.variantMismatch,
    };
  } catch (err) {
    console.error("[amazon-match] search failed:", err);
    return null;
  }
}
