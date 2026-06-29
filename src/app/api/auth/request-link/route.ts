/**
 * src/app/api/auth/request-link/route.ts
 *
 * NODE RUNTIME. Step 1 of the magic-link flow: takes an email, creates
 * a signed short-lived token (magic-token.ts), and emails a link
 * containing that token. Crucially, this endpoint does NOT create a
 * session — it only sends mail. A session is only ever issued by the
 * Credentials provider's authorize() after the token is verified
 * (see src/auth/auth.ts).
 *
 * This always responds with a generic success message regardless of
 * whether the email is "valid" in any business sense, to avoid leaking
 * which emails are registered users (standard practice for auth flows).
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMagicToken } from "@/lib/auth/magic-token";
import { sendMagicLinkEmail } from "@/lib/email/send";
import { getRuntimeConfig } from "@/lib/runtime-config";
import type { ApiResponse } from "@/types";

const bodySchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      const body: ApiResponse<never> = { ok: false, error: "Invalid JSON body", code: "INVALID_INPUT" };
      return NextResponse.json(body, { status: 400 });
    }

    const parsed = bodySchema.safeParse(payload);
    if (!parsed.success) {
      const body: ApiResponse<never> = { ok: false, error: "A valid email is required", code: "INVALID_INPUT" };
      return NextResponse.json(body, { status: 400 });
    }

    const { email } = parsed.data;
    const { appUrl } = getRuntimeConfig();

    const token = createMagicToken(email);
    // IMPORTANT: the Credentials provider's authorize() only receives
    // credentials submitted via HTTP POST (signIn() call) — it does NOT
    // automatically read GET query params on /api/auth/callback/email.
    // So the link points at a normal page that, on load, calls
    // signIn("email", { token }) client-side. See
    // src/app/auth/verify/page.tsx.
    const magicLinkUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}`;

    // sendMagicLinkEmail is itself fallback-safe (logs to console if
    // Resend isn't configured) — never throws, so this route doesn't
    // need extra try/catch around just this call.
    await sendMagicLinkEmail({ to: email, magicLinkUrl });

    const okBody: ApiResponse<{ sent: true }> = {
      ok: true,
      data: { sent: true },
      mock: false,
    };
    return NextResponse.json(okBody, { status: 200 });
  } catch (err) {
    console.error("[api/auth/request-link] unexpected error:", err);
    // Still return a generic success-shaped response — never reveal
    // internal failure details for an auth-adjacent endpoint, and never
    // 500 here per the project's "always JSON, never crash" contract.
    const body: ApiResponse<{ sent: true }> = { ok: true, data: { sent: true }, mock: true };
    return NextResponse.json(body, { status: 200 });
  }
}