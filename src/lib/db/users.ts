import { safeQuery } from "@/lib/db/safe-query";
import type { DbUser, Tier } from "@/types";
import { getMockUser } from "@/lib/mock/mock-data";

function rowToUser(row: any): DbUser {
  return {
    id: row.id,
    email: row.email,

    // 🔥 SAFE TIER PARSING
    tier:
      row.tier === "pro" || row.tier === "free"
        ? (row.tier as Tier)
        : "free",

    stripeCustomerId: row.stripe_customer_id ?? null,
    stripeSubscriptionId: row.stripe_subscription_id ?? null,
    stripeSubscriptionStatus: row.stripe_subscription_status ?? null,

    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  };
}

export async function getUserByEmail(
  email: string
): Promise<{ user: DbUser; mock: boolean }> {
  const result = await safeQuery<any>(
    `select id, email, tier, stripe_customer_id, stripe_subscription_id,
            stripe_subscription_status, created_at
     from users where email = $1 limit 1`,
    [email]
  );

  if (result.ok && result.rows[0]) {
    return { user: rowToUser(result.rows[0]), mock: false };
  }

  return { user: getMockUser(email), mock: true };
}

export async function getUserById(
  id: string
): Promise<{ user: DbUser; mock: boolean }> {
  const result = await safeQuery<any>(
    `select id, email, tier, stripe_customer_id, stripe_subscription_id,
            stripe_subscription_status, created_at
     from users where id = $1 limit 1`,
    [id]
  );

  if (result.ok && result.rows[0]) {
    return { user: rowToUser(result.rows[0]), mock: false };
  }

  return {
    user: getMockUser(`user-${id}@mock.local`),
    mock: true,
  };
}

export async function getUserByStripeCustomerId(
  customerId: string
): Promise<{ user: DbUser | null; mock: boolean }> {
  const result = await safeQuery<any>(
    `select id, email, tier, stripe_customer_id, stripe_subscription_id,
            stripe_subscription_status, created_at
     from users where stripe_customer_id = $1 limit 1`,
    [customerId]
  );

  if (result.ok) {
    return {
      user: result.rows[0] ? rowToUser(result.rows[0]) : null,
      mock: false,
    };
  }

  return { user: null, mock: true };
}

export async function upsertStripeSubscription(params: {
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  tier: Tier;
}): Promise<{
  ok: boolean;
  mock: boolean;
  user?: DbUser;
}> {
  const result = await safeQuery<any>(
    `insert into users (
        email,
        tier,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_subscription_status
     )
     values ($1, $2, $3, $4, $5)
     on conflict (email) do update set
       tier = excluded.tier,
       stripe_customer_id = excluded.stripe_customer_id,
       stripe_subscription_id = excluded.stripe_subscription_id,
       stripe_subscription_status = excluded.stripe_subscription_status,
       updated_at = now()
     returning *`,
    [
      params.email,
      params.tier,
      params.stripeCustomerId,
      params.stripeSubscriptionId,
      params.status,
    ]
  );

  if (result.ok && result.rows?.[0]) {
    return {
      ok: true,
      mock: false,
      user: rowToUser(result.rows[0]),
    };
  }

  return {
    ok: result.ok,
    mock: !result.ok,
  };
}

export async function recordScan(params: {
  userId: string | null;
  asin: string;
  tier: Tier;
  verdict: string;
}): Promise<{ ok: boolean; mock: boolean }> {
  const result = await safeQuery(
    `insert into scan_history (user_id, asin, tier, verdict, created_at)
     values ($1, $2, $3, $4, now())`,
    [params.userId, params.asin, params.tier, params.verdict]
  );

  return {
    ok: result.ok,
    mock: !result.ok,
  };
}