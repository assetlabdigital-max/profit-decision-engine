import { signIn } from "@/auth/auth";

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px" }}>
      <h1>Sign in</h1>

      <p>We'll email you a magic link.</p>

      <form
        action={async (formData) => {
          "use server";

          const email = formData.get("email") as string;

          await signIn("email", {
            email,
            redirectTo: "/dashboard",
          });
        }}
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          style={{
            padding: 10,
            width: "100%",
            boxSizing: "border-box",
            marginBottom: 12,
          }}
        />

        <button
          type="submit"
          style={{
            padding: "10px 16px",
            width: "100%",
          }}
        >
          Send magic link
        </button>
      </form>
    </main>
  );
}
