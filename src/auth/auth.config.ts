import type { NextAuthConfig } from "next-auth";
import { getRuntimeConfig } from "@/lib/runtime-config";

/**
 * EDGE-SAFE AUTH CONFIG (FINAL STABLE VERSION)
 *
 * - middleware.ts 전용 Edge 안전 구성
 * - DB / Resend / pg 완전 제외
 * - JWT 기반 세션만 사용
 * - CSRF / cookie / host 문제 전체 해결
 */

const isProduction =
  process.env.NODE_ENV === "production" ||
  getRuntimeConfig().appUrl.startsWith("https://");

export const authConfig: NextAuthConfig = {
  providers: [],

  secret: getRuntimeConfig().auth.secret,

  trustHost: true,

  /**
   * 🔥 핵심: CSRF / 쿠키 문제 해결
   */
  useSecureCookies: isProduction,

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

      if (isDashboard) return isLoggedIn;
      return true;
    },

    jwt({ token, user }) {
      if (user) {
        token.tier = (user as any).tier ?? "free";
        token.id = user.id;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        (session.user as any).tier = (token as any).tier ?? "free";
        (session.user as any).id = token.id;
      }
      return session;
    },
  },

  /**
   * 🔥 CSRF + 쿠키 완전 고정 설정
   */
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },

    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
};