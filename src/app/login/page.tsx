"use client";

/**
 * src/app/login/page.tsx
 *
 * Step 1 of the magic-link flow: calls POST /api/auth/request-link with
 * the entered email. That endpoint signs a token and emails a link
 * pointing at /auth/verify?token=... — visiting that page is what
 * actually authenticates the user (see src/auth/auth.ts). This page
 * itself never creates a session.
 */

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      setStatus(json.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px" }}>
      <h1>Sign in</h1>

      {status === "sent" ? (
        <p style={{ background: "#eafff0", padding: 12, borderRadius: 6 }}>
          Check your email for a sign-in link. It expires in 15 minutes.
        </p>
      ) : (
        <>
          <p>We'll email you a magic link.</p>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: 10, width: "100%", boxSizing: "border-box", marginBottom: 12 }}
            />
            <button type="submit" disabled={status === "sending"} style={{ padding: "10px 16px", width: "100%" }}>
              {status === "sending" ? "Sending..." : "Send magic link"}
            </button>
            {status === "error" && (
              <p style={{ color: "#a00", fontSize: 13, marginTop: 8 }}>
                Something went wrong. Please try again.
              </p>
            )}
          </form>
        </>
      )}
    </main>
  );
}