-- migrations/002_app_tables.sql
-- Application-specific tables: scan history (analytics) and Stripe
-- webhook idempotency tracking. Safe to re-run.

create table if not exists scan_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete set null,
  asin text not null,
  tier text not null check (tier in ('free', 'pro')),
  verdict text not null check (verdict in ('BUY', 'SKIP', 'RISK')),
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_history_user_id on scan_history(user_id);
create index if not exists idx_scan_history_created_at on scan_history(created_at desc);

-- Idempotency guard for Stripe webhooks. Each Stripe event id is
-- inserted exactly once; ON CONFLICT DO NOTHING in application code
-- is what makes double-delivery a no-op.
create table if not exists processed_stripe_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

create index if not exists idx_processed_stripe_events_processed_at
  on processed_stripe_events(processed_at desc);
