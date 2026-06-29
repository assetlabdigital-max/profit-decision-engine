/**
 * src/lib/scan/resolve-tier.ts
 *
 * DEBUG VERSION
 * Tier resolution logging enabled (STEP 7)
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

    // 🔥 DEBUG TRACE 1
    console.log("================================");
    console.log("[resolveTier DEBUG] session =", session);
    console.log("================================");

    const email = session?.user?.email ?? null;

    // 🔥 DEBUG TRACE 2
    console.log("[resolveTier DEBUG] email =", email);

    if (!email) {
      const tier: Tier = "free";

      console.log("[resolveTier DEBUG] anonymous user -> FREE");

      // 🔥 FINAL TIER TRACE (REQUESTED FIX)
      console.log("================================");
      console.log("[resolveTier DEBUG FINAL tier =", tier);
      console.log("================================");

      return {
        tier,
        userId: null,
        email: null,
        usedFallback: false,
      };
    }

    const sessionTier =
      ((session?.user as any)?.tier as Tier) ?? "free";

    // 🔥 DEBUG TRACE 3
    console.log("[resolveTier DEBUG] sessionTier =", sessionTier);

    try {
      const { user, mock } = await getUserByEmail(email);

      // 🔥 DB TRACE
      console.log("[resolveTier DEBUG] DB user =", user);
      console.log("[resolveTier DEBUG] DB tier =", user.tier);

      const tier: Tier = user.tier;

      // 🔥 FINAL TIER TRACE (DB PATH)
      console.log("================================");
      console.log("[resolveTier DEBUG FINAL tier =", tier);
      console.log("================================");

      return {
        tier,
        userId: user.id,
        email,
        usedFallback: mock,
      };
    } catch (dbErr) {
      console.error(
        "[resolveTier DEBUG] DB lookup failed, fallback to session tier:",
        dbErr
      );

      const tier: Tier = sessionTier;

      // 🔥 FINAL TIER TRACE (SESSION FALLBACK PATH)
      console.log("================================");
      console.log("[resolveTier DEBUG FINAL tier =", tier);
      console.log("================================");

      return {
        tier,
        userId: null,
        email,
        usedFallback: true,
      };
    }
  } catch (err) {
    console.error(
      "[resolveTier DEBUG] auth() failed -> FREE fallback:",
      err
    );

    const tier: Tier = "free";

    // 🔥 FINAL TIER TRACE (AUTH FAILURE PATH)
    console.log("================================");
    console.log("[resolveTier DEBUG FINAL tier =", tier);
    console.log("================================");

    return {
      tier,
      userId: null,
      email: null,
      usedFallback: true,
    };
  }
}
