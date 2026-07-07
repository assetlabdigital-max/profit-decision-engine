/**
 * Shared title parsing for retail ↔ Amazon matching.
 */

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Multi-pack listing count (2-pack, twin pack, set of 3). */
export function extractPackCount(title: string): number {
  const norm = normalizeText(title);

  const explicit = norm.match(/(\d+)\s*pack\b/);
  if (explicit) return Math.max(1, parseInt(explicit[1], 10));

  if (/\b(twin|duo|double)\s+pack\b/.test(norm) || /\b2\s*pack\b/.test(norm)) return 2;
  if (/\b3\s*pack\b/.test(norm) || /\btriple\s+pack\b/.test(norm)) return 3;
  if (/\b4\s*pack\b/.test(norm)) return 4;
  if (/\b6\s*pack\b/.test(norm)) return 6;
  if (/\b12\s*pack\b/.test(norm)) return 12;

  if (/\bset\s+of\s+(\d+)\b/.test(norm)) {
    const m = norm.match(/\bset\s+of\s+(\d+)\b/);
    if (m) return Math.max(1, parseInt(m[1], 10));
  }

  if (/\bpack\s+of\s+(\d+)\b/.test(norm)) {
    const m = norm.match(/\bpack\s+of\s+(\d+)\b/);
    if (m) return Math.max(1, parseInt(m[1], 10));
  }

  if (/\bvariety\s+pack\b/.test(norm) || /\bassorted\b/.test(norm)) return 2;

  return 1;
}

/** Total unit count (e.g. 24-count water, 12 ct). Distinct from multipack listings. */
export function extractUnitCount(title: string): number | null {
  const norm = normalizeText(title);

  const patterns = [
    /\b(\d+)\s*count\b/,
    /\b(\d+)\s*ct\b/,
    /\b(\d+)\s*pk\b/,
    /\b(\d+)\s*pack\b/,
    /\bpack\s+of\s+(\d+)\b/,
    /\b(\d+)\s*x\s*\d+/,
  ];

  for (const pattern of patterns) {
    const m = norm.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 1) return n;
    }
  }

  return null;
}

/** Normalize volume to fluid ounces when possible. */
export function extractVolumeFlOz(title: string): number | null {
  const norm = normalizeText(title);

  const flOz = norm.match(/(\d+(?:\.\d+)?)\s*(?:fl\s*oz|fluid\s*ounce|fluid\s*oz)\b/);
  if (flOz) return parseFloat(flOz[1]);

  const ozOnly = norm.match(/\b(\d+(?:\.\d+)?)\s*oz\b/);
  if (ozOnly) return parseFloat(ozOnly[1]);

  const ml = norm.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (ml) return parseFloat(ml[1]) / 29.5735;

  const liter = norm.match(/(\d+(?:\.\d+)?)\s*(?:l|liter|litre)\b/);
  if (liter) return parseFloat(liter[1]) * 33.814;

  const gallon = norm.match(/(\d+(?:\.\d+)?)\s*(?:gal|gallon)\b/);
  if (gallon) return parseFloat(gallon[1]) * 128;

  return null;
}

/** Normalize weight to ounces when possible. */
export function extractWeightOz(title: string): number | null {
  const norm = normalizeText(title);

  const lb = norm.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound)\b/);
  if (lb) return parseFloat(lb[1]) * 16;

  const oz = norm.match(/(\d+(?:\.\d+)?)\s*oz\b/);
  if (oz) return parseFloat(oz[1]);

  const kg = norm.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kg) return parseFloat(kg[1]) * 35.274;

  const g = norm.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (g) return parseFloat(g[1]) / 28.3495;

  return null;
}

const COLOR_WORDS = [
  "black", "white", "red", "blue", "green", "yellow", "pink", "purple", "orange",
  "gray", "grey", "brown", "beige", "navy", "teal", "gold", "silver", "charcoal",
  "ivory", "cream", "tan", "burgundy", "coral", "lavender", "mint", "olive",
];

export function extractColors(title: string): Set<string> {
  const norm = normalizeText(title);
  const found = new Set<string>();
  for (const color of COLOR_WORDS) {
    if (new RegExp(`\\b${color}\\b`).test(norm)) found.add(color);
  }
  return found;
}

const SIZE_PATTERNS = [
  /\b(x{0,3}s|x{0,3}l|small|medium|large|xlarge|xxl|xxxl)\b/i,
  /\bsize\s*(\d+(?:\.\d+)?)\b/i,
  /\b(\d{1,2})\s*(?:inch|in|")\b/i,
  /\bw(\d{2})\b/i,
];

export function extractSizes(title: string): Set<string> {
  const norm = normalizeText(title);
  const found = new Set<string>();
  for (const pattern of SIZE_PATTERNS) {
    const m = norm.match(pattern);
    if (m) found.add(m[1] ?? m[0]);
  }
  return found;
}

/** Model / SKU-like tokens (electronics, appliances). */
export function extractModelTokens(title: string): Set<string> {
  const norm = normalizeText(title);
  const tokens = new Set<string>();

  const patterns = norm.match(/\b[a-z]{0,4}\d{3,}[a-z0-9-]*\b/g) ?? [];
  for (const p of patterns) {
    if (p.length >= 4) tokens.add(p);
  }

  const modelTag = norm.match(/\bmodel\s*[#:]?\s*([a-z0-9-]+)\b/);
  if (modelTag) tokens.add(modelTag[1]);

  const skuTag = norm.match(/\bsku\s*[#:]?\s*([a-z0-9-]+)\b/);
  if (skuTag) tokens.add(skuTag[1]);

  return tokens;
}

export function significantTokens(
  value: string,
  stopWords: Set<string>
): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((t) => t.length > 2 && !stopWords.has(t))
  );
}
