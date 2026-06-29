/**
 * src/auth/auth.ts
 *
 * NODE RUNTIME ONLY. NEVER import this file from middleware.ts.
 *
 * AUTH FLOW (DB-free, token-verified magic link):
 *   1. POST /api/auth/request-link { email } creates a signed,
 *      15-minute token (src/lib/auth/magic-token.ts) and emails a link
 *      containing it. No session is issued at this step.
 *   2. The user clicks the link, which lands on /auth/verify, which
 *      calls signIn("email", { token }) — this Credentials provider's
 *      authorize() then verifies the HMAC signature and expiry BEFORE
 *      returning a user object. Only a valid, unexpired, correctly-
 *      signed token results in a session.
 *
 * SECURITY NOTE — why this replaced the previous version: the prior
 * Credentials provider accepted a raw `email` field with no
 * verification at all and returned a session immediately, which let
 * anyone authenticate as any email address by posting it directly to
 * the callback endpoint. This version cannot be bypassed that way: a
 * session is only issued for a token whose HMAC signature was produced
 * by this server using AUTH_SECRET, which an attacker does not have.
 *
 * There is intentionally no database adapter (`adapter` is omitted) —
 * sessions are JWT-only, consistent with the project's DB-optional
 * design. Signature verification, not a DB lookup, is what makes this
 * safe.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth/auth.config";
import { verifyMagicToken } from "@/lib/auth/magic-token";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      id: "email",
      name: "Email link",
      credentials: { token: {} },

      async authorize(credentials) {
        const token = credentials?.token as string | undefined;
        if (!token) return null;

        const verification = verifyMagicToken(token);
        if (!verification.ok) {
          console.warn(`[auth] magic token rejected: ${verification.reason}`);
          return null;
        }

        const { email } = verification;
        return {
          id: email,
          email,
          name: email.split("@")[0],
          tier: "free",
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  trustHost: true,
});

/**
 * Email sign-in is always available in this token-verified design — it
 * has no database dependency. Kept as a function (rather than deleting
 * call sites) so other files that check this flag don't need to change.
 */
export function isEmailSignInAvailable(): boolean {
  return true;
}