/**
 * Client-safe retail store URL detection (no Apify / server deps).
 */

export const RETAIL_STORE_PATTERNS = [
  { name: "Costco", domains: ["costco.com"] },
  { name: "Walmart", domains: ["walmart.com"] },
  { name: "Target", domains: ["target.com"] },
  { name: "Sam's Club", domains: ["samsclub.com"] },
  { name: "Walgreens", domains: ["walgreens.com"] },
  { name: "CVS", domains: ["cvs.com"] },
  { name: "Ulta", domains: ["ulta.com"] },
  { name: "Home Depot", domains: ["homedepot.com"] },
  { name: "Best Buy", domains: ["bestbuy.com"] },
] as const;

export const RETAIL_STORE_HINT =
  "Costco, Walmart, Target, Sam's Club, Walgreens, CVS, Ulta, Home Depot, or Best Buy";

export function isRetailUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (!lower) return false;
  return RETAIL_STORE_PATTERNS.some((store) =>
    store.domains.some((domain) => lower.includes(domain))
  );
}

export function retailStoreNameFromUrl(url: string): string | null {
  const lower = url.trim().toLowerCase();
  const match = RETAIL_STORE_PATTERNS.find((store) =>
    store.domains.some((domain) => lower.includes(domain))
  );
  return match?.name ?? null;
}
