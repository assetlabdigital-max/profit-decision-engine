-- migrations/005_enable_rls.sql
-- Supabase security: enable Row Level Security and block PostgREST access
-- for anon/authenticated roles on every public table.
-- The Next.js app uses DATABASE_URL (postgres service role) server-side only;
-- it bypasses RLS and keeps working. Safe to re-run.

do $$
declare
  tbl text;
begin
  for tbl in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table if exists public.%I enable row level security', tbl);
    execute format('alter table if exists public.%I force row level security', tbl);
    execute format('revoke all on table public.%I from anon, authenticated', tbl);
  end loop;
end
$$;

alter default privileges in schema public revoke all on tables from anon, authenticated;
