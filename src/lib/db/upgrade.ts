import { safeQuery } from "@/lib/db/safe-query";

export async function upgradeUserToPro(params: {
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}) {
  const result = await safeQuery(
    `
    INSERT INTO users (
      email,
      tier,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_subscription_status
    )
    VALUES ($1, 'pro', $2, $3, 'active')

    ON CONFLICT(email)
    DO UPDATE SET
      tier = 'pro',
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      stripe_subscription_status = 'active',
      updated_at = now()

    RETURNING *;
    `,
    [
      params.email,
      params.stripeCustomerId,
      params.stripeSubscriptionId,
    ]
  );

  return {
    ok: result.ok && result.rows?.length > 0,
    mock: !result.ok,
    row: result.rows?.[0] ?? null,
  };
}