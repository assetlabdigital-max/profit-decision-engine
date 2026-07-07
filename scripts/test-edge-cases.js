/**
 * scripts/test-edge-cases.js — edge-case detection smoke tests (no framework).
 */

const assert = require("node:assert/strict");

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/[^\w\s&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractVolumeFlOz(title) {
  const norm = normalizeText(title);
  const flOz = norm.match(/(\d+(?:\.\d+)?)\s*(?:fl\s*oz|fluid\s*ounce)\b/);
  if (flOz) return parseFloat(flOz[1]);
  const ozOnly = norm.match(/\b(\d+(?:\.\d+)?)\s*oz\b/);
  if (ozOnly) return parseFloat(ozOnly[1]);
  return null;
}

function extractPackCount(title) {
  const norm = normalizeText(title);
  const explicit = norm.match(/(\d+)\s*pack\b/);
  if (explicit) return Math.max(1, parseInt(explicit[1], 10));
  return 1;
}

function titleHasAny(title, phrases) {
  const norm = normalizeText(title);
  return phrases.some((p) => norm.includes(p));
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

test("volume mismatch: 16oz vs 32oz", () => {
  const a = extractVolumeFlOz("Lotion 16 fl oz");
  const b = extractVolumeFlOz("Lotion 32 fl oz");
  assert.ok(a && b && Math.abs(a - b) > 8);
});

test("refurbished Amazon title detected", () => {
  assert.ok(titleHasAny("Sony Headphones (Renewed)", ["renewed", "refurbished"]));
});

test("bundle keyword detected", () => {
  assert.ok(titleHasAny("Skincare Gift Set 5 Piece", ["gift set", "bundle"]));
});

test("24-count vs single pack count", () => {
  assert.equal(extractPackCount("Purified Water 24 Pack"), 24);
  assert.equal(extractPackCount("Single Bottle Water"), 1);
});

test("eos variant: different pack counts", () => {
  const retail = "eos Shea Better Body Lotion Beach Waves 16 fl oz";
  const amazon = "eos Shea Better Body Lotion Vanilla Cashmere 2-Pack";
  assert.notEqual(extractPackCount(retail), extractPackCount(amazon));
});

console.log(`\n${passed} edge-case tests passed`);
