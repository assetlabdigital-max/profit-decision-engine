/**
 * src/lib/scan/resolve-tier.ts
 *
 * NODE RUNTIME. Determines the caller's tier for the scan API.
 *
 * Priority:
 *   1. If logged in, try the DB for authoritative tier/subscription status.
 *   2. If DB is unavailable, fall back to the tier already embedded in
 *      the session JWT (set at login/refresh time) — slightly stale but
 *      never absent.
 *   3. If not logged in at all, tier is always "free".
 *
 * This function never throws — any failure resolves to "free", which is
 * the safe default (never accidentally grants Pro data on error).
 */

import { auth } from "@/auth/auth";
import { getUserByEmail } from "@/lib/db/users";
import type { Tier } from "@/types";

export interface ResolvedTier {
  tier: Tier;
  userId: string | null;
  email: string | null;
  usedFallback: boolean;
}

export async function resolveTier(): Promise<ResolvedTier> {
  try {
    const session = await auth();
    const email = session?.user?.email ?? null;

    if (!email) {
      return { tier: "free", userId: null, email: null, usedFallback: false };
    }

    const sessionTier = ((session?.user as any)?.tier as Tier) ?? "free";

    try {
      const { user, mock } = await getUserByEmail(email);
      return {
        tier: user.tier,
        userId: user.id,
        email,
        usedFallback: mock,
      };
    } catch (dbErr) {
      console.error("[resolveTier] DB lookup failed, using session JWT tier:", dbErr);
      return { tier: sessionTier, userId: null, email, usedFallback: true };
    }
  } catch (err) {
    // auth() itself failing (e.g. malformed cookie) must not break the
    // scan endpoint — default to anonymous free tier.
    console.error("[resolveTier] auth() failed, defaulting to anonymous free tier:", err);
    return { tier: "free", userId: null, email: null, usedFallback: true };
  }
}
