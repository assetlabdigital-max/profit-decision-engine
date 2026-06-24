import { prisma } from "@/lib/db/prisma";

export async function validateApiKey(key?: string) {
  if (!key) return null;

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      key,
      active: true,
    },
  });

  if (!apiKey) return null;

  return {
    userId: apiKey.userId,
    tier: "pro",
  };
}
