-- DormGlide products + manual transactions schema updates

create extension if not exists pgcrypto;

-- Products table lifecycle fields
alter table if exists public.products
add column if not exists status text not null default 'active',
add column if not exists requested_at timestamptz null,
add column if not exists sold_at timestamptz null,
add column if not exists buyer_id uuid null,
add column if not exists sold_method text null,
add column if not exists buyer_confirmed_at timestamptz null,
add column if not exists seller_confirmed_at timestamptz null;

alter table if exists public.products
drop constraint if exists products_status_check;

alter table if exists public.products
add constraint products_status_check check (status in ('active', 'sold'));

create index if not exists products_status_idx on public.products(status);

-- Transactions table for manual payment methods (zelle/venmo/cash)
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

alter table public.transactions enable row level security;

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

-- Support requests (lightweight buyer protection intake)
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

alter table public.support_requests enable row level security;

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
