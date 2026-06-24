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

    // 🔥 DEBUG TRACE 3
    console.log("[resolveTier DEBUG] sessionTier =", sessionTier);

    try {
      const { user, mock } = await getUserByEmail(email);

      // 🔥 DB TRACE
      console.log("[resolveTier DEBUG] DB user =", user);
      console.log("[resolveTier DEBUG] DB tier =", user.tier);

      return {
        tier: user.tier,
        userId: user.id,
        email,
        usedFallback: mock,
      };
    } catch (dbErr) {
      console.error(
        "[resolveTier DEBUG] DB lookup failed, fallback to session tier:",
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
      "[resolveTier DEBUG] auth() failed -> FREE fallback:",
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
