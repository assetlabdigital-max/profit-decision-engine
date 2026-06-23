/**
 * src/lib/scan/resolve-tier.ts
 *
 * DEBUG VERSION
 * Tier resolution logging enabled
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

    console.log("================================");
    console.log("[resolveTier] session =", session);
    console.log("================================");

    const email = session?.user?.email ?? null;

    console.log("[resolveTier] email =", email);

    if (!email) {
      console.log("[resolveTier] anonymous user -> FREE");

      return {
        tier: "free",
        userId: null,
        email: null,
        usedFallback: false,
      };
    }

    const sessionTier =
      ((session?.user as any)?.tier as Tier) ?? "free";

    console.log("[resolveTier] session tier =", sessionTier);

    try {
      const { user, mock } = await getUserByEmail(email);

      console.log("[resolveTier] DB user =", user);
      console.log("[resolveTier] DB tier =", user.tier);

      return {
        tier: user.tier,
        userId: user.id,
        email,
        usedFallback: mock,
      };
    } catch (dbErr) {
      console.error(
        "[resolveTier] DB lookup failed, using JWT tier:",
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
      "[resolveTier] auth() failed, defaulting FREE:",
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
