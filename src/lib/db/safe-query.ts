/**
 * src/lib/db/safe-query.ts (DEBUG + SaaS SAFE VERSION)
 */

import { getPool } from "@/lib/db/pool";
import { isDbEnabled } from "@/lib/runtime-config";

export type SafeQueryResult<T> =
  | { ok: true; rows: T[]; mock: false }
  | { ok: false; error: string; mock: true; rawError?: unknown };

const QUERY_TIMEOUT_MS = 4000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`DB_TIMEOUT_${ms}ms`)), ms);
  });
}

export async function safeQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<SafeQueryResult<T>> {
  const debugPrefix = `[DB safeQuery]`;

  console.log(debugPrefix, "QUERY:", text);
  console.log(debugPrefix, "PARAMS:", params);

  if (!isDbEnabled()) {
    console.warn(debugPrefix, "DB disabled → MOCK mode");
    return {
      ok: false,
      error: "DB disabled (no DATABASE_URL or FORCE_MOCK_DB=true)",
      mock: true,
    };
  }

  const pool = getPool();

  if (!pool) {
    console.error(debugPrefix, "POOL MISSING");
    return {
      ok: false,
      error: "DB pool unavailable",
      mock: true,
    };
  }

  try {
    const result = await Promise.race([
      pool.query(text, params),
      timeout(QUERY_TIMEOUT_MS),
    ]);

    console.log(debugPrefix, "SUCCESS ROWS:", result.rows?.length ?? 0);

    return {
      ok: true,
      rows: result.rows as T[],
      mock: false,
    };
  } catch (err) {
    console.error(debugPrefix, "FAILED QUERY:", text);
    console.error(debugPrefix, "ERROR:", err);

    const message = err instanceof Error ? err.message : "unknown db error";

    return {
      ok: false,
      error: message,
      mock: true,
      rawError: err,
    };
  }
}

export async function isDbReachable(): Promise<boolean> {
  const res = await safeQuery("SELECT 1 as ok");
  return res.ok;
}