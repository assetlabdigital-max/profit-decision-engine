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

  // IMPORTANT: safeQuery returns a discriminated union —
  // { ok: true; rows: T[] } | { ok: false; error: string }.
  // `result.rows` only exists on the `ok: true` branch, so we must
  // check `result.ok` FIRST. TypeScript then narrows the type inside
  // this block and `result.rows` becomes safely accessible.
  if (!result.ok) {
    return {
      ok: false,
      mock: true,
      row: null,
    };
  }

  return {
    ok: result.rows.length > 0,
    mock: false,
    row: result.rows[0] ?? null,
  };
}