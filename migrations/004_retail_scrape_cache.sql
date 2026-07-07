-- migrations/004_retail_scrape_cache.sql
-- Caches successful retail product scrapes to avoid repeat Apify runs.
-- Safe to re-run.

create table if not exists retail_scrape_cache (
  url_hash text primary key,
  store_name text not null,
  product_name text not null,
  store_price numeric(12, 2) not null,
  brand text,
  product_url text not null,
  currency text not null default 'USD',
  scraped_at timestamptz not null default now()
);

create index if not exists idx_retail_scrape_cache_scraped_at
  on retail_scrape_cache(scraped_at desc);
