-- migrations/003_tiktok_cache_tables.sql
-- Cache tables for TikTok trend data fetched from Apify. The whole point
-- of these tables is that /api/tiktok/* routes NEVER call Apify directly
-- on a user request — they only ever read from here. Apify is only
-- called by the manual refresh endpoint, which writes results here.
-- Safe to re-run.

-- Snapshot of trending hashtags (Discover-tab style). Each manual refresh
-- replaces the "current" snapshot but keeps history via fetched_at, so we
-- can later show trend-over-time if useful.
create table if not exists tiktok_trending_hashtags (
  id uuid default gen_random_uuid() primary key,
  hashtag text not null,
  rank integer,
  view_count bigint,
  video_count bigint,
  industry_category text,
  is_mock boolean not null default false,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_tiktok_trending_fetched_at
  on tiktok_trending_hashtags(fetched_at desc);
create index if not exists idx_tiktok_trending_hashtag
  on tiktok_trending_hashtags(hashtag);

-- Cached search/hashtag results (keyword or hashtag -> matching videos).
-- Keyed by normalized query so repeated lookups of the same term serve
-- from cache instantly.
create table if not exists tiktok_hashtag_videos (
  id uuid default gen_random_uuid() primary key,
  query text not null,
  query_type text not null check (query_type in ('hashtag', 'keyword')),
  video_id text,
  author_username text,
  caption text,
  play_count bigint,
  like_count bigint,
  comment_count bigint,
  share_count bigint,
  video_url text,
  posted_at timestamptz,
  is_mock boolean not null default false,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_tiktok_videos_query
  on tiktok_hashtag_videos(query, query_type);
create index if not exists idx_tiktok_videos_fetched_at
  on tiktok_hashtag_videos(fetched_at desc);

-- Tracks manual refresh triggers so we can rate-limit / show "last
-- refreshed X minutes ago" in the UI and prevent accidental spam-clicking
-- from burning Apify credits.
create table if not exists tiktok_refresh_log (
  id uuid default gen_random_uuid() primary key,
  refresh_type text not null check (refresh_type in ('trending', 'search')),
  query text,
  triggered_by uuid references users(id) on delete set null,
  status text not null check (status in ('success', 'failed', 'mock_fallback')),
  items_fetched integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tiktok_refresh_log_created_at
  on tiktok_refresh_log(created_at desc);
create index if not exists idx_tiktok_refresh_log_type_query
  on tiktok_refresh_log(refresh_type, query);
