import { prisma } from "./prisma";
import crypto from "crypto";

export function generateApiKey() {
  return "pk_" + crypto.randomBytes(24).toString("hex");
}

export async function createApiKey(userId: string) {
  const key = generateApiKey();

  await prisma.apiKey.create({
    data: {
      userId,
      key,
      active: true,
    },
  });

  console.log("[API KEY CREATED]", userId);

  return key;
}
