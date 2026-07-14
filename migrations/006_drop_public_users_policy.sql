-- migrations/006_drop_public_users_policy.sql
-- Removes a permissive RLS policy (USING true / WITH CHECK true for public)
-- that allowed unrestricted PostgREST access to the users table including
-- email and Stripe identifiers. PDE writes users via server-side DATABASE_URL only.
-- Safe to re-run.

drop policy if exists "allow webhook insert" on public.users;
