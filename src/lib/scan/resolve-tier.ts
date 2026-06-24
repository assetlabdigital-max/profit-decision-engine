/**
 * src/lib/scan/resolve-tier.ts
 *
 * DEBUG VERSION — FULL VISIBILITY ENABLED
 * SAFE FOR PRODUCTION (NO THROW GUARANTEE)
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

    // 🔥 STEP 7 DEBUG BLOCK (SESSION TRACE)
    console.log("====================================");
    console.log("[resolveTier DEBUG] session =", session);
    console.log("====================================");

    const email = session?.user?.email ?? null;

    console.log("[resolveTier DEBUG] email =", email);

    if (!email) {
      console.log("[resolveTier DEBUG] anonymous user -> FREE");

      return {
        tier: "free",
        userId: null,
        email: null,
        usedFallback: false,
      };
    }

    const sessionTier =
      ((session?.user as any)?.tier as Tier) ?? "free";

    console.log("[resolveTier DEBUG] sessionTier =", sessionTier);

    try {
      const { user, mock } = await getUserByEmail(email);

      console.log("====================================");
      console.log("[resolveTier DEBUG] DB USER =", user);
      console.log("[resolveTier DEBUG] DB TIER =", user.tier);
      console.log("====================================");

      return {
        tier: user.tier,
        userId: user.id,
        email,
        usedFallback: mock,
      };
    } catch (dbErr) {
      console.error(
        "[resolveTier DEBUG] DB lookup failed → fallback to JWT tier",
        dbErr
      );

      return {
        tier: sessionTier,
        userId: null,
        email,
        usedFallback: true,
      };
    }
  } catch (err) {
    console.error(
      "[resolveTier DEBUG] auth() failed → FORCE FREE",
      err
    );

    return {
      tier: "free",
      userId: null,
      email: null,
      usedFallback: true,
    };
  }
}
