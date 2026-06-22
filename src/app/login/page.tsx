import { signIn, isEmailSignInAvailable } from "@/auth/auth";

export default function LoginPage() {
  const emailAvailable = isEmailSignInAvailable();

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px" }}>
      <h1>Sign in</h1>

      {emailAvailable ? (
        <>
          <p>We'll email you a magic link.</p>
          <form
            action={async (formData) => {
              "use server";
              const email = formData.get("email") as string;
              await signIn("resend", { email, redirectTo: "/dashboard" });
            }}
          >
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              style={{ padding: 10, width: "100%", boxSizing: "border-box", marginBottom: 12 }}
            />
            <button type="submit" style={{ padding: "10px 16px", width: "100%" }}>
              Send magic link
            </button>
          </form>
        </>
      ) : (
        <p style={{ background: "#fff3cd", padding: 12, borderRadius: 6 }}>
          Sign-in is temporarily unavailable: this requires a connected database, which isn't
          configured right now. Other parts of the app (scans, pricing) still work normally.
        </p>
      )}
    </main>
  );
}
