/**
 * src/lib/email/send.ts
 *
 * NODE RUNTIME ONLY (imports the `resend` SDK lazily).
 *
 * Email sending is OPTIONAL per project rules. If RESEND_API_KEY is
 * missing or the API call fails, we log the magic link to the console
 * (so local dev / demos still work end-to-end) and return successfully
 * rather than throwing. Auth must never fail just because email failed.
 */

import { isEmailEnabled, getRuntimeConfig } from "@/lib/runtime-config";

interface SendMagicLinkParams {
  to: string;
  magicLinkUrl: string;
}

export async function sendMagicLinkEmail({ to, magicLinkUrl }: SendMagicLinkParams): Promise<{
  sent: boolean;
  mock: boolean;
}> {
  if (!isEmailEnabled()) {
    console.log(`[email:MOCK] Would send magic link to ${to}: ${magicLinkUrl}`);
    return { sent: false, mock: true };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resend } = require("resend") as typeof import("resend");
    const { email } = getRuntimeConfig();
    const resend = new Resend(email.apiKey);

    const { error } = await resend.emails.send({
      from: email.from,
      to,
      subject: "Sign in to Profit Decision Engine",
      html: renderMagicLinkHtml(magicLinkUrl),
    });

    if (error) {
      console.error("[email] Resend API returned an error, falling back to console log:", error);
      console.log(`[email:FALLBACK] Magic link for ${to}: ${magicLinkUrl}`);
      return { sent: false, mock: true };
    }

    return { sent: true, mock: false };
  } catch (err) {
    console.error("[email] send failed unexpectedly, falling back to console log:", err);
    console.log(`[email:FALLBACK] Magic link for ${to}: ${magicLinkUrl}`);
    return { sent: false, mock: true };
  }
}

function renderMagicLinkHtml(url: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Sign in to Profit Decision Engine</h2>
      <p>Click the button below to sign in. This link expires shortly.</p>
      <p style="margin: 24px 0;">
        <a href="${url}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">
          Sign in
        </a>
      </p>
      <p style="color:#666;font-size:12px;">If you didn't request this, you can ignore this email.</p>
    </div>
  `;
}
