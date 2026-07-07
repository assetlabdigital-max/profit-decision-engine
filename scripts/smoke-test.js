/**
 * scripts/smoke-test.js
 *
 * Quick E2E smoke checks against a running instance (local or production).
 * Read-only / safe-by-default — does not trigger Stripe checkout or Apify refresh.
 *
 * Usage:
 *   npm run dev          # in another terminal
 *   npm run smoke        # defaults to http://localhost:3000
 *   npm run smoke -- https://www.profit-decision-engine.com
 */

const baseUrl = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, error: message });
    console.error(`✗ ${name}: ${message}`);
  }
}

async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return body;
}

async function postJson(path, payload, expectedStatus) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== expectedStatus) {
    throw new Error(`POST ${path} → expected ${expectedStatus}, got ${res.status}`);
  }
  return body;
}

async function main() {
  console.log(`Smoke testing ${baseUrl}\n`);

  await check("GET /api/health returns ok", async () => {
    const body = await getJson("/api/health");
    if (!body.ok || body.status !== "up") throw new Error("health not up");
    if (!body.services) throw new Error("missing services block");
  });

  await check("POST /api/scan returns verdict", async () => {
    const body = await postJson("/api/scan", { asin: "B0SMOKE1234" }, 200);
    if (!body.ok || !body.data?.verdict) throw new Error("missing scan verdict");
    if (!["BUY", "SKIP", "RISK"].includes(body.data.verdict)) {
      throw new Error(`unexpected verdict: ${body.data.verdict}`);
    }
  });

  await check("GET /api/tiktok/trending returns data", async () => {
    const body = await getJson("/api/tiktok/trending");
    if (!body.ok || !Array.isArray(body.data)) throw new Error("missing trending array");
  });

  await check("POST /api/stripe/checkout unauthenticated → 401", async () => {
    await postJson("/api/stripe/checkout", { plan: "monthly" }, 401);
  });

  await check("POST /api/auth/request-link accepts email", async () => {
    const body = await postJson(
      "/api/auth/request-link",
      { email: "smoke-test@example.com" },
      200
    );
    if (!body.ok) throw new Error("request-link failed");
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log(`\n${passed}/${results.length} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
