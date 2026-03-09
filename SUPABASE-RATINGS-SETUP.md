# Supabase Seller Ratings Setup (DormGlide)

DormGlide now supports seller ratings (1-5 stars). If this table exists, ratings are shared across devices/users via Supabase. If not, the app falls back to local browser storage.

## 1) Create table

Run in Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.seller_ratings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  buyer_id uuid not null,
  product_id text null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text null,
  created_at timestamptz not null default now()
);

create unique index if not exists seller_ratings_unique_review
  on public.seller_ratings (seller_id, buyer_id, coalesce(product_id, ''));

create index if not exists seller_ratings_seller_idx on public.seller_ratings (seller_id);
create index if not exists seller_ratings_buyer_idx on public.seller_ratings (buyer_id);
create index if not exists seller_ratings_created_at_idx on public.seller_ratings (created_at desc);
```

## 2) Enable RLS

```sql
alter table public.seller_ratings enable row level security;
```

## 3) Policies

```sql
drop policy if exists "seller_ratings_select_public" on public.seller_ratings;
drop policy if exists "seller_ratings_insert_buyer" on public.seller_ratings;
drop policy if exists "seller_ratings_update_buyer" on public.seller_ratings;

create policy "seller_ratings_select_public"
on public.seller_ratings
for select
to anon, authenticated
using (true);

create policy "seller_ratings_insert_buyer"
on public.seller_ratings
for insert
to authenticated
with check (auth.uid() = buyer_id and auth.uid() <> seller_id);

create policy "seller_ratings_update_buyer"
on public.seller_ratings
for update
to authenticated
using (auth.uid() = buyer_id)
with check (auth.uid() = buyer_id and auth.uid() <> seller_id);
```
