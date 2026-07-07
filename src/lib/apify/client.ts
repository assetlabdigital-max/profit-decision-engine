/**
 * src/lib/apify/client.ts
 *
 * NODE RUNTIME ONLY. Thin wrapper around Apify's REST API using plain
 * fetch() — no SDK dependency needed for the "run actor and wait for
 * results" pattern we use here.
 *
 * CRITICAL DESIGN CONSTRAINT (per project decision): this client is
 * ONLY ever called from user-initiated write paths (manual TikTok refresh,
 * retail URL scans), NEVER from a passive read path like /api/tiktok/trending.
 *
 * Apify runs can take anywhere from a few seconds to a couple of
 * minutes depending on the actor and result count, so we use the
 * "run-sync-get-dataset-items" endpoint with a generous but bounded
 * timeout, and treat ANY failure (timeout, non-2xx, malformed JSON) as
 * a normal, expected outcome that the caller falls back from — not an
 * exceptional crash condition.
 */

import { isApifyEnabled, getRuntimeConfig } from "@/lib/runtime-config";

const APIFY_RUN_TIMEOUT_MS = 90_000; // generous: scraping actors are slow
const APIFY_BASE_URL = "https://api.apify.com/v2";

export type ApifyRunResult<T> =
  | { ok: true; items: T[] }
  | { ok: false; error: string };

/** Ping Apify with the configured token — presence alone is not enough. */
export async function validateApifyToken(): Promise<"live" | "error" | "mock"> {
  if (!isApifyEnabled()) return "mock";

  const { apify } = getRuntimeConfig();
  try {
    const response = await fetch(
      `${APIFY_BASE_URL}/users/me?token=${encodeURIComponent(apify.token as string)}`,
      { signal: timeoutSignal(8_000) }
    );
    return response.ok ? "live" : "error";
  } catch (err) {
    console.error("[apify] token validation failed:", err);
    return "error";
  }
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Runs an Apify actor synchronously and returns its dataset items.
 * actorId should be in the "owner~actor-name" format used by Apify's
 * REST API path segments (slashes are NOT used in the URL path).
 *
 * NEVER throws. All failure modes resolve to { ok: false, error }.
 */
export async function runApifyActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  options?: { timeoutSecs?: number }
): Promise<ApifyRunResult<T>> {
  if (!isApifyEnabled()) {
    return { ok: false, error: "Apify disabled (no APIFY_API_TOKEN or FORCE_MOCK_APIFY=true)" };
  }

  const timeoutSecs = options?.timeoutSecs ?? 90;
  const { apify } = getRuntimeConfig();
  // Apify actor paths use a literal tilde — encoding it breaks routing.
  const actorPath = actorId.replace("/", "~");
  const url = `${APIFY_BASE_URL}/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(
    apify.token as string
  )}&timeout=${timeoutSecs}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: timeoutSignal(timeoutSecs * 1000 + 10_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "<unreadable body>");
      return {
        ok: false,
        error: `Apify run failed: HTTP ${response.status} — ${text.slice(0, 300)}`,
      };
    }

    const items = (await response.json()) as T[];
    if (!Array.isArray(items)) {
      return { ok: false, error: "Apify response was not an array of dataset items" };
    }

    return { ok: true, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown Apify client error";
    console.error(`[apify] run failed for actor ${actorId} (handled, caller should fall back):`, message);
    return { ok: false, error: message };
  }
}
