import { auth } from "@/auth/auth";
import { getUserByEmail } from "@/lib/db/users";
import type { Tier } from "@/types";

export interface ResolvedTier {
  tier: Tier;
  userId: string | null;
  usedFallback: boolean;
}

export async function resolveTier(): Promise<ResolvedTier> {
  try {
    const session = await auth();
    const email = session?.user?.email ?? null;

    if (!email) {
      return { tier: "free", userId: null, usedFallback: false };
    }

    const sessionTier = ((session?.user as any)?.tier as Tier) ?? "free";

    try {
      const { user, mock } = await getUserByEmail(email);
      return { tier: user.tier, userId: user.id, usedFallback: mock };
    } catch (dbErr) {
      console.error("[resolveTier] DB lookup failed, using session JWT tier:", dbErr);
      return { tier: sessionTier, userId: null, usedFallback: true };
    }
  } catch (err) {
    console.error("[resolveTier] auth() failed, defaulting to free tier:", err);
    return { tier: "free", userId: null, usedFallback: true };
  }
}