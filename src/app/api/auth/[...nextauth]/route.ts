/**
 * src/app/api/auth/[...nextauth]/route.ts
 *
 * NODE RUNTIME (explicit). This is the only place src/auth/auth.ts
 * (which imports pg + resend) gets pulled into the request graph for
 * the auth flow itself.
 */

export const runtime = "nodejs";

import { handlers } from "@/auth/auth";

export const { GET, POST } = handlers;
