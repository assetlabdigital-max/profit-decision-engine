"use client";

/**
 * src/app/auth/verify/page.tsx
 *
 * Step 2 of the magic-link flow. The link emailed by
 * /api/auth/request-link points here with ?token=... . On load, this
 * page POSTs that token to the Credentials provider via signIn() —
 * which is required because next-auth's Credentials provider only
 * accepts credentials submitted by POST, not GET query params. Only if
 * src/auth/auth.ts's authorize() verifies the token's HMAC signature
 * and expiry does a session actually get created.
 *
 * Wrapped in <Suspense> because useSearchParams() requires it in the
 * App Router — without this, `next build` fails to prerender this
 * route with "should be wrapped in a suspense boundary".
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "error">("verifying");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      return;
    }

    signIn("email", { token, redirect: false, callbackUrl: "/dashboard" }).then((res) => {
      if (res?.ok) {
        router.push("/dashboard");
      } else {
        setStatus("error");
      }
    });
  }, [params, router]);

  if (status === "error") {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px" }}>
        <h1>Link expired or invalid</h1>
        <p>
          This sign-in link is no longer valid — it may have expired (links last 15 minutes) or
          already been used. <a href="/login">Request a new one</a>.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px" }}>
      <h1>Signing you in…</h1>
      <p>One moment.</p>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px" }}>
          <p>Loading…</p>
        </main>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}