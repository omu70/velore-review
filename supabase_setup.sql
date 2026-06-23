-- =============================================================
-- VELORE REVIEWS — FULL SUPABASE SETUP
-- Paste this whole file into Supabase -> SQL Editor -> Run.
-- Safe to re-run (idempotent).
-- =============================================================

-- ===================== BASE SCHEMA =====================
-- =============================================================
-- Shopify Reviews App — Supabase Schema
-- File location:  /supabase/schema.sql
-- Run this once in Supabase → SQL Editor.
-- =============================================================

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 1) shops  — tracks installations & gates the free tier
-- -------------------------------------------------------------
create table if not exists public.shops (
  shop_domain   text        primary key,
  installed_at  timestamptz not null default now(),
  plan_type     text        not null default 'standard'
                              check (plan_type in ('early_adopter_free','standard'))
);

comment on table  public.shops is 'One row per installed Shopify store.';
comment on column public.shops.plan_type is
  'early_adopter_free for the first 50 stores, standard afterwards.';

-- -------------------------------------------------------------
-- 2) reviews
-- -------------------------------------------------------------
create table if not exists public.reviews (
  id              uuid        primary key default gen_random_uuid(),
  shop_domain     text        not null references public.shops(shop_domain) on delete cascade,
  product_id      text        not null,
  author_name     text        not null,
  author_initials text        not null,
  is_verified     boolean     not null default true,
  rating          integer     not null check (rating between 1 and 5),
  content         text        not null,
  status          text        not null default 'approved'
                                check (status in ('approved','pending','hidden')),
  created_at      timestamptz not null default now()
);

-- Hot-path indexes
create index if not exists idx_reviews_shop_domain on public.reviews (shop_domain);
create index if not exists idx_reviews_product_id  on public.reviews (product_id);
create index if not exists idx_reviews_shop_product_status
  on public.reviews (shop_domain, product_id, status);
create index if not exists idx_reviews_created_at  on public.reviews (created_at desc);

-- -------------------------------------------------------------
-- 3) Row Level Security  (recommended; service-role bypasses)
-- -------------------------------------------------------------
alter table public.shops   enable row level security;
alter table public.reviews enable row level security;

-- Public storefront read: only approved reviews
drop policy if exists "Public read approved reviews" on public.reviews;
create policy "Public read approved reviews"
  on public.reviews for select
  using (status = 'approved');

-- The Remix app uses the service-role key on the server,
-- which automatically bypasses RLS for inserts/updates/deletes.

-- ===================== MIGRATION 002: images + source + storage =====================
-- =============================================================
-- Migration 002 — Images + Source tracking + Storage bucket
-- Run this in Supabase SQL Editor (safe to re-run).
-- =============================================================

-- Add image_urls (array) and source columns to reviews
alter table public.reviews
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists source text not null default 'storefront'
    check (source in ('storefront', 'csv_import', 'manual'));

-- Index for filtering by source (e.g. hide AI samples from storefront)
create index if not exists idx_reviews_source on public.reviews (source);

-- Update RLS: only show approved reviews on the storefront
drop policy if exists "Public read approved reviews" on public.reviews;
create policy "Public read approved reviews"
  on public.reviews for select
  using (status = 'approved');

-- =============================================================
-- Storage bucket for review images
-- =============================================================
-- Create a public bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do nothing;

-- Allow public read of review images
drop policy if exists "Public read review images" on storage.objects;
create policy "Public read review images"
  on storage.objects for select
  using (bucket_id = 'review-images');

-- Allow service-role uploads (the Remix server uploads via the SDK)
drop policy if exists "Service role uploads" on storage.objects;
create policy "Service role uploads"
  on storage.objects for insert
  with check (bucket_id = 'review-images');

-- ===================== MIGRATION 003: author location =====================
-- =============================================================
-- Migration 003 — Add author location to reviews
-- Run in Supabase SQL Editor (safe to re-run).
-- =============================================================

alter table public.reviews
  add column if not exists author_location text;

create index if not exists idx_reviews_author_location on public.reviews (author_location);

-- ===================== MIGRATION 004: trustoo-compatible fields =====================
-- =============================================================
-- Migration 004 — Trustoo-compatible review fields
-- Run in Supabase SQL Editor (safe to re-run).
-- =============================================================

alter table public.reviews
  add column if not exists product_handle text,
  add column if not exists title          text,
  add column if not exists author_email   text,
  add column if not exists author_country text,
  add column if not exists reply          text,
  add column if not exists reply_at       timestamptz,
  add column if not exists is_featured    boolean not null default false,
  add column if not exists item_type      text,
  add column if not exists video_url      text;

-- Indexes for filtering / sorting
create index if not exists idx_reviews_product_handle on public.reviews (product_handle);
create index if not exists idx_reviews_is_featured    on public.reviews (is_featured);

-- Allow CSV imports to pre-set commented_at by overriding created_at —
-- nothing structural to do; just permit historical timestamps via update path.

-- ===================== MIGRATION 005: store-wide reviews =====================
-- =============================================================
-- Migration 005 — Allow store-wide reviews (no product attached)
-- Run in Supabase SQL Editor (safe to re-run).
-- =============================================================

-- product_id may now be NULL for store-wide reviews
alter table public.reviews
  alter column product_id drop not null;

-- Make sure product_handle is also nullable
alter table public.reviews
  alter column product_handle drop not null;

-- Index for filtering store-wide reviews
create index if not exists idx_reviews_store_wide
  on public.reviews (shop_domain, status)
  where product_id is null and product_handle is null;

-- ===================== SHOPIFY SESSIONS (OAuth session storage) =====================
-- Required by the app's Supabase-backed session storage (no Prisma needed).
create table if not exists public.shopify_sessions (
  id          text        primary key,
  shop        text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);
create index if not exists idx_shopify_sessions_shop on public.shopify_sessions (shop);
alter table public.shopify_sessions enable row level security;
-- No public policies on purpose: only the service-role key (server-side) can touch sessions.
