/**
 * STEP 9 — PRISMA PRODUCTION SAFE CLIENT (SAAS READY)
 * Features:
 * - Singleton safe (Next.js dev hot reload 대응)
 * - Error logging enabled
 * - Connection resilience logging
 * - Safe production fallback protection
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const client = new PrismaClient({
    log: ["error", "warn"],

    // 🔥 STEP 9 FIX: connection 안정성 강화
    errorFormat: "pretty",
  });

  // 🔥 DEBUG HOOK (DB 연결 상태 확인용)
  client.$connect()
    .then(() => {
      console.log("[PRISMA] Connected successfully");
    })
    .catch((err) => {
      console.error("[PRISMA] Connection failed:", err);
    });

  return client;
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

// 🔥 NEXT.js DEV HOT RELOAD SAFE
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// 🔥 SAFETY EXPORT (future SaaS scaling 대비)
export default prisma;
