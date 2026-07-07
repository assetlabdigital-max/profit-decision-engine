/**
 * scripts/test-match-quality.js
 *
 * Lightweight unit checks for retail match-quality helpers (no test framework).
 */

const assert = require("node:assert/strict");

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/[^\w\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "in", "on", "of", "to", "by",
  "women", "womens", "men", "mens", "kids", "black", "white", "size",
]);

function significantTokens(value) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
  );
}

function tokenOverlapScore(a, b) {
  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }
  return shared / Math.max(tokensA.size, tokensB.size);
}

function extractPackCount(title) {
  const norm = normalizeText(title);
  const explicit = norm.match(/(\d+)\s*pack\b/);
  if (explicit) return Math.max(1, parseInt(explicit[1], 10));
  if (/\b(twin|duo|double)\s+pack\b/.test(norm) || /\b2\s+pack\b/.test(norm)) return 2;
  return 1;
}

function detectVariantMismatch(retailTitle, amazonTitle) {
  const retailPack = extractPackCount(retailTitle);
  const amazonPack = extractPackCount(amazonTitle);
  const mismatched = retailPack !== amazonPack;
  return { mismatched, retailPack, amazonPack };
}

let passed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}:`, err.message);
    process.exitCode = 1;
  }
}

test("extractPackCount detects 2-pack", () => {
  assert.equal(extractPackCount("eos Body Lotion 2-Pack"), 2);
  assert.equal(extractPackCount("Single Bottle"), 1);
});

test("detectVariantMismatch flags pack differences", () => {
  const result = detectVariantMismatch(
    "eos Shea Better Body Lotion - Beach Waves",
    "eos Shea Better Body Lotion Vanilla Cashmere 2-Pack"
  );
  assert.equal(result.mismatched, true);
  assert.equal(result.retailPack, 1);
  assert.equal(result.amazonPack, 2);
});

test("tokenOverlapScore is high for similar titles", () => {
  const score = tokenOverlapScore(
    "eos Shea Better Body Lotion Beach Waves 16 fl oz",
    "eos Shea Better Body Lotion - Beach Waves Moisturizer 16 oz"
  );
  assert.ok(score > 0.4, `expected > 0.4, got ${score}`);
});

test("tokenOverlapScore is low for unrelated titles", () => {
  const score = tokenOverlapScore("Nice! Purified Water 24 pack", "Sony WH-1000XM5 Headphones");
  assert.ok(score < 0.2, `expected < 0.2, got ${score}`);
});

console.log(`\n${passed} tests passed`);
