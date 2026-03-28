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
  payment_link text null,
  images text[] not null default '{}',
  main_image text null,

  seller_id uuid not null,
  seller_name text not null,
  seller_email text not null,
  seller_campus text null,

  status text not null default 'active',
  requested_at timestamptz null,
  sold_at timestamptz null,
  buyer_id uuid null,
  sold_method text null,
  buyer_confirmed_at timestamptz null,
  seller_confirmed_at timestamptz null,

  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  views integer not null default 0
);

create index if not exists products_created_at_idx on public.products(created_at desc);
create index if not exists products_seller_id_idx on public.products(seller_id);
create index if not exists products_category_idx on public.products(category);
```

If your `products` table already exists, run this once to add Stripe support:

```sql
alter table public.products
add column if not exists payment_link text null;

alter table public.products
add column if not exists status text not null default 'active',
add column if not exists requested_at timestamptz null,
add column if not exists sold_at timestamptz null,
add column if not exists buyer_id uuid null,
add column if not exists sold_method text null,
add column if not exists buyer_confirmed_at timestamptz null,
add column if not exists seller_confirmed_at timestamptz null;

alter table public.products
drop constraint if exists products_status_check;

alter table public.products
add constraint products_status_check check (status in ('active', 'sold'));
```

## 1.5) Create transactions table (manual methods: zelle/venmo/cash)

```sql
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid null references public.products(id) on delete set null,
  seller_id uuid null,
  buyer_id uuid null,
  amount numeric not null default 0,
  currency text not null default 'USD',
  payment_method text not null default 'cash',
  status text not null default 'completed',
  source text not null default 'manual_chat',
  notes text null,
  confirmed_by_seller_at timestamptz null,
  confirmed_by_buyer_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists transactions_created_at_idx on public.transactions(created_at desc);
create index if not exists transactions_product_id_idx on public.transactions(product_id);
create index if not exists transactions_seller_id_idx on public.transactions(seller_id);
create index if not exists transactions_buyer_id_idx on public.transactions(buyer_id);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid null references public.products(id) on delete set null,
  reporter_id uuid null,
  counterparty_id uuid null,
  issue_type text not null default 'other',
  details text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists support_requests_created_at_idx on public.support_requests(created_at desc);
create index if not exists support_requests_product_id_idx on public.support_requests(product_id);
create index if not exists support_requests_reporter_id_idx on public.support_requests(reporter_id);
```

## 2) Enable RLS

```sql
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.support_requests enable row level security;
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

drop policy if exists "transactions_select_participants" on public.transactions;
drop policy if exists "transactions_insert_participants" on public.transactions;

create policy "transactions_select_participants"
on public.transactions
for select
to authenticated
using (auth.uid() = seller_id or auth.uid() = buyer_id);

create policy "transactions_insert_participants"
on public.transactions
for insert
to authenticated
with check (auth.uid() = seller_id or auth.uid() = buyer_id);

drop policy if exists "support_requests_select_participants" on public.support_requests;
drop policy if exists "support_requests_insert_reporter" on public.support_requests;

create policy "support_requests_select_participants"
on public.support_requests
for select
to authenticated
using (auth.uid() = reporter_id or auth.uid() = counterparty_id);

create policy "support_requests_insert_reporter"
on public.support_requests
for insert
to authenticated
with check (auth.uid() = reporter_id);
```

## 4) Notes

- The app sends `seller_id` as the currently logged-in user id (Supabase Auth `auth.uid()`).
- If you are using local-only login (not Supabase Auth), Supabase inserts will fail (no authenticated session).
- After this is set up, new products will be visible to everyone when Supabase is active.
- You can now record manual chat-based deals in `transactions` for GMV tracking.
- `requested_at` enables the in-app deal timeline (requested -> buyer confirmed -> seller confirmed).
- `support_requests` powers lightweight buyer protection intake for the first 48 hours after a sale.

### Quick metrics query (GMV + completion)

```sql
select
  count(*) as total_transactions,
  count(*) filter (where status = 'completed') as completed_transactions,
  coalesce(sum(amount) filter (where status = 'completed'), 0) as gmv_usd,
  round(
    100.0 * count(*) filter (where status = 'completed') / nullif(count(*), 0),
    2
  ) as completion_rate_percent
from public.transactions;
```


