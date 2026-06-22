/**
 * src/lib/db/safe-query.ts
 *
 * NODE RUNTIME ONLY (imports pool.ts, which imports `pg`).
 *
 * This is the ONLY function the rest of the app should use to talk to
 * Postgres. It guarantees:
 *   1. It never throws — every error becomes { ok: false, error }.
 *   2. It never hangs the request — a hard timeout race is applied.
 *   3. Callers always get a discriminated union so TypeScript forces
 *      the fallback path to be handled.
 */

import { getPool } from "@/lib/db/pool";
import { isDbEnabled } from "@/lib/runtime-config";

export type SafeQueryResult<T> =
  | { ok: true; rows: T[]; mock: false }
  | { ok: false; error: string; mock: true };

const QUERY_TIMEOUT_MS = 4000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`db query timed out after ${ms}ms`)), ms);
  });
}

/**
 * Run a parameterized SQL query safely.
 * On ANY failure (no pool, connection error, syntax error, timeout),
 * returns { ok: false } instead of throwing. Callers must branch on
 * `.ok` and fall back to mock data when false — this is enforced by
 * the return type, not just convention.
 */
export async function safeQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<SafeQueryResult<T>> {
  if (!isDbEnabled()) {
    return { ok: false, error: "DB disabled (no DATABASE_URL or FORCE_MOCK_DB=true)", mock: true };
  }

  const pool = getPool();
  if (!pool) {
    return { ok: false, error: "DB pool unavailable", mock: true };
  }

  try {
    const result = await Promise.race([pool.query(text, params), timeout(QUERY_TIMEOUT_MS)]);
    return { ok: true, rows: result.rows as T[], mock: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown db error";
    console.error("[db] query failed, caller should fall back to mock:", message);
    return { ok: false, error: message, mock: true };
  }
}

/** Convenience: returns true if a real DB round-trip currently succeeds. */
export async function isDbReachable(): Promise<boolean> {
  const res = await safeQuery("SELECT 1 as ok");
  return res.ok;
}
