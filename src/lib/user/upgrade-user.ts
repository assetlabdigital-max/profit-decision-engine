import { safeQuery } from "@/lib/db/safe-query";

export async function upgradeUserToPro(params: {
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}) {
  return await safeQuery(
    `
    update users
    set
      tier = 'pro',
      stripe_customer_id = $1,
      stripe_subscription_id = $2,
      stripe_subscription_status = 'active',
      updated_at = now()
    where email = $3
    `,
    [
      params.stripeCustomerId,
      params.stripeSubscriptionId,
      params.email,
    ]
  );
}