# Supabase Products Setup (DormGlide)

If one user posts a product and other users can’t see it, it usually means the app is saving to **localStorage** (device-only) instead of Supabase.

To make listings shared for everyone, create the `products` table in Supabase and add RLS policies.

## 1) Create table

Run in **Supabase SQL Editor**:

```sql
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  price numeric not null,
  category text not null,
  condition text not null,
  location text null,
  contact_info text null,
  images text[] not null default '{}',
  main_image text null,

  seller_id uuid not null,
  seller_name text not null,
  seller_email text not null,
  seller_campus text null,

  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  views integer not null default 0
);

create index if not exists products_created_at_idx on public.products(created_at desc);
create index if not exists products_seller_id_idx on public.products(seller_id);
create index if not exists products_category_idx on public.products(category);
```

## 2) Enable RLS

```sql
alter table public.products enable row level security;
```

## 3) Policies

### Public browsing (recommended like Mercari)

Allows everyone (even logged-out visitors) to browse listings.

```sql
drop policy if exists "products_select_public" on public.products;

create policy "products_select_public"
on public.products
for select
to anon, authenticated
using (true);
```

### Only logged-in users can post

```sql
drop policy if exists "products_insert_authenticated" on public.products;

create policy "products_insert_authenticated"
on public.products
for insert
to authenticated
with check (auth.uid() = seller_id);
```

### Only the seller can edit/delete their listing

```sql
drop policy if exists "products_update_owner" on public.products;
drop policy if exists "products_delete_owner" on public.products;

create policy "products_update_owner"
on public.products
for update
to authenticated
using (auth.uid() = seller_id)
with check (auth.uid() = seller_id);

create policy "products_delete_owner"
on public.products
for delete
to authenticated
using (auth.uid() = seller_id);
```

## 4) Notes

- The app sends `seller_id` as the currently logged-in user id (Supabase Auth `auth.uid()`).
- If you are using local-only login (not Supabase Auth), Supabase inserts will fail (no authenticated session).
- After this is set up, new products will be visible to everyone when Supabase is active.
