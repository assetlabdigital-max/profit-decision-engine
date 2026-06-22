-- migrations/001_auth_tables.sql
-- Tables required by @auth/pg-adapter (Auth.js v5).
-- Schema follows the official Auth.js Postgres adapter contract.
-- Safe to re-run: every statement uses IF NOT EXISTS.

create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  name text,
  email text unique not null,
  "emailVerified" timestamptz,
  image text,
  -- App-specific columns appended to the standard Auth.js users table.
  tier text not null default 'free' check (tier in ('free', 'pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  stripe_subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid default gen_random_uuid() primary key,
  "userId" uuid not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  unique (provider, "providerAccountId")
);

create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  "userId" uuid not null references users(id) on delete cascade,
  expires timestamptz not null,
  "sessionToken" text not null unique
);

create table if not exists verification_token (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);

create index if not exists idx_accounts_user_id on accounts("userId");
create index if not exists idx_sessions_user_id on sessions("userId");
create index if not exists idx_users_email on users(email);
create index if not exists idx_users_stripe_customer_id on users(stripe_customer_id);
