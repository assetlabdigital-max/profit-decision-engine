import { spApiCall, isAmazonEnabled } from "@/lib/amazon/client";

export type EligibilityStatus = "eligible" | "restricted" | "unknown";

export interface EligibilityResult {
  status: EligibilityStatus;
  reason: string | null;
}

export async function checkEligibility(asin: string): Promise<EligibilityResult> {
  if (!isAmazonEnabled()) {
    return { status: "unknown", reason: "SP-API not configured" };
  }

  try {
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER";
    const sellerId = process.env.AMAZON_SELLER_ID;

    if (!sellerId) {
      return { status: "unknown", reason: "AMAZON_SELLER_ID not configured" };
    }

    const data = await spApiCall<any>(
      `/listings/2021-08-01/restrictions?asin=${asin}&sellerId=${sellerId}&marketplaceIds=${marketplaceId}&conditionType=new_new`
    );

    const restrictions = data?.restrictions ?? [];

    if (restrictions.length === 0) {
      return { status: "eligible", reason: null };
    }

    const reasons = restrictions
      .flatMap((r: any) => r.reasons ?? [])
      .map((r: any) => r.message)
      .filter(Boolean);

    return {
      status: "restricted",
      reason: reasons[0] ?? "This product requires approval to sell.",
    };
  } catch (err: any) {
    if (err?.message?.includes("403")) {
      return { status: "restricted", reason: "Approval required to sell this product." };
    }
    console.error(`[amazon/eligibility] failed for ${asin}:`, err);
    return { status: "unknown", reason: null };
  }
}