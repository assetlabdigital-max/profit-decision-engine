/**
 * src/auth/auth.config.ts
 *
 * EDGE-SAFE. This file is imported by BOTH middleware.ts (Edge runtime)
 * and auth.ts (Node runtime). To stay Edge-compatible it must NEVER import:
 *   - pg / @auth/pg-adapter
 *   - resend
 *   - any provider that itself pulls in Node-only code
 *
 * Per the project rules, `providers` stays an empty array here — real
 * providers (Resend email provider, which needs Node) are added only in
 * auth.ts. This file exists so middleware can call `auth()` for a cheap
 * "is there a session" check without ever touching the database adapter.
 */

import type { NextAuthConfig } from "next-auth";
import { getRuntimeConfig } from "@/lib/runtime-config";

export const authConfig: NextAuthConfig = {
  providers: [],
  // Edge-safe: getRuntimeConfig() only reads process.env strings, no
  // Node-only APIs, so it's fine to call here too.
  secret: getRuntimeConfig().auth.secret,
  // Required so the Edge-side auth() check (used by middleware) doesn't
  // reject requests with an UntrustedHost error. Safe because we always
  // run behind a reverse proxy / platform that sets Host correctly
  // (Vercel, etc.); for self-hosted deployments behind a custom proxy,
  // ensure X-Forwarded-Host is set correctly upstream.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      // Edge-safe authorization check used by middleware.
      // No DB lookups here — only inspects the JWT already on the request.
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard");

      if (isOnDashboard) {
        return isLoggedIn;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.tier = (user as any).tier ?? "free";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).tier = (token as any).tier ?? "free";
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
