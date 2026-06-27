import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth/auth.config";
import { sendMagicLinkEmail } from "@/lib/email/send";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  adapter: undefined,

  providers: [
    Credentials({
      id: "email",
      credentials: { email: {} },

      async authorize(credentials) {
        const email = credentials?.email as string;

        if (!email) return null;

        const url =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3008";

        const magicLink = `${url}/dashboard?email=${encodeURIComponent(
          email
        )}`;

        await sendMagicLinkEmail({
          to: email,
          magicLinkUrl: magicLink,
        });

        return {
          id: email,
          email,
          name: email.split("@")[0],
          tier: "free",
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  trustHost: true,
});