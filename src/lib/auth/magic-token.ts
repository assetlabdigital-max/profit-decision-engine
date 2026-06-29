/**
 * src/lib/auth/magic-token.ts
 *
 * NODE RUNTIME. Self-contained, DB-free magic-link token signing and
 * verification using HMAC-SHA256 (Node's built-in `crypto`, no new
 * dependency). This replaces a previous Credentials-provider flow that
 * returned a session for ANY submitted email with no verification at
 * all — that flow let anyone log in as anyone by just POSTing their
 * target's email address.
 *
 * Token shape (before signing): `${email}|${expiresAtMs}`
 * Signed token sent in the magic link: `${payload}|${hmacHex}`
 *
 * IMPORTANT: '|' is the field separator, not '.'. Email addresses
 * commonly contain '.' (e.g. first.last@sub.example.com), which broke
 * naive splitting in an earlier version of this file — confirmed by
 * direct testing, not just inspection. '|' cannot appear in a valid
 * email address or in a numeric timestamp, so it cannot collide with
 * the data being split.
 *
 * Verification re-computes the HMAC over the payload and does a
 * constant-time comparison against the provided signature, then checks
 * the expiry. Both checks must pass for the token to be valid.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { getRuntimeConfig } from "@/lib/runtime-config";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SEP = "|";

function getSigningSecret(): string {
  // Reuses AUTH_SECRET so no new env var / secret management is needed.
  return getRuntimeConfig().auth.secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

/** Builds a signed token for the given email, valid for TOKEN_TTL_MS. */
export function createMagicToken(email: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${email}${SEP}${expiresAt}`;
  const signature = sign(payload);
  // Base64url-encode the whole thing so it's a single safe URL query param.
  return Buffer.from(`${payload}${SEP}${signature}`).toString("base64url");
}

export type MagicTokenVerification =
  | { ok: true; email: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/** Verifies a token produced by createMagicToken. Never throws. */
export function verifyMagicToken(token: string): MagicTokenVerification {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(SEP);
    if (parts.length !== 3) return { ok: false, reason: "malformed" };

    const [email, expiresAtStr, signature] = parts;
    const expiresAt = Number(expiresAtStr);
    if (!email || !Number.isFinite(expiresAt)) return { ok: false, reason: "malformed" };

    const payload = `${email}${SEP}${expiresAtStr}`;
    const expectedSignature = sign(payload);

    // Constant-time comparison — prevents timing-attack signature guessing.
    const provided = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return { ok: false, reason: "bad_signature" };
    }

    if (Date.now() > expiresAt) {
      return { ok: false, reason: "expired" };
    }

    return { ok: true, email };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}