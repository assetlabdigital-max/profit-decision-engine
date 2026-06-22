/**
 * src/lib/db/pool.ts
 *
 * NODE RUNTIME ONLY. Never import this file from middleware.ts or any
 * file that might be bundled into the Edge runtime — `pg` uses Node-only
 * APIs (net, tls, dns) that do not exist on Edge and will crash the build
 * or the Edge worker at request time.
 *
 * Design:
 * - The pool is created lazily, once, on first real query attempt.
 * - Construction itself is wrapped so a malformed DATABASE_URL cannot
 *   throw during module evaluation (which would crash the whole route).
 * - If DB is disabled via runtime-config, we never even attempt to
 *   require('pg') or open a socket.
 */

import { isDbEnabled, getRuntimeConfig } from "@/lib/runtime-config";
import type { Pool as PgPool } from "pg";

let pool: PgPool | null = null;
let initFailed = false;

/**
 * Returns a live pg Pool, or null if DB is disabled / failed to init.
 * NEVER throws.
 */
export function getPool(): PgPool | null {
  if (!isDbEnabled()) return null;
  if (initFailed) return null;
  if (pool) return pool;

  try {
    // Lazy require so this code path (and the `pg` module) is never
    // touched at all when DB is disabled — keeps cold boot fast and safe.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require("pg") as typeof import("pg");
    const { db } = getRuntimeConfig();

    pool = new Pool({
      connectionString: db.url,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: db.url?.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
    });

    // Pools emit 'error' on idle client failures (e.g. connection dropped).
    // Without this handler, that event would throw an unhandled error and
    // can crash the Node process. We swallow it and let safeQuery's
    // per-call try/catch handle actual query failures.
    pool.on("error", (err) => {
      console.error("[db] pool error (handled, non-fatal):", err.message);
    });

    return pool;
  } catch (err) {
    console.error("[db] failed to initialize pool, falling back to mock mode:", err);
    initFailed = true;
    pool = null;
    return null;
  }
}

/** Used by /api/health and tests to reset state between checks. */
export function __resetPoolForTesting() {
  pool = null;
  initFailed = false;
}
