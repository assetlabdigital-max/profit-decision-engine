/**
 * Per-user scan rate limiting (DB-backed, hourly window).
 * NODE RUNTIME ONLY.
 */

import { safeQuery } from "@/lib/db/safe-query";
import type { Tier } from "@/types";

const HOURLY_LIMITS: Record<Tier, number> = {
  free: 10,
  pro: 50,
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function isScanRateLimited(
  userId: string | null,
  tier: Tier
): Promise<{ limited: boolean; mock: boolean; count?: number; limit?: number }> {
  if (!userId || !isUuid(userId)) {
    return { limited: false, mock: true };
  }

  const limit = HOURLY_LIMITS[tier] ?? HOURLY_LIMITS.free;

  const result = await safeQuery<{ count: number }>(
    `select count(*)::int as count
     from scan_history
     where user_id = $1::uuid
       and created_at > now() - interval '1 hour'`,
    [userId]
  );

  if (!result.ok) {
    return { limited: false, mock: true };
  }

  const count = result.rows[0]?.count ?? 0;
  return {
    limited: count >= limit,
    mock: false,
    count,
    limit,
  };
}
