import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function redirectToLogin(req: NextRequest) {
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = pathname.startsWith("/dashboard");

  // ⚠️ Edge-safe 방식: cookie check only
  const hasSession = req.cookies.has("next-auth.session-token") ||
                     req.cookies.has("__Secure-next-auth.session-token");

  if (isProtected && !hasSession) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
