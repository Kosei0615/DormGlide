-- DormGlide purchase request flow schema updates

create extension if not exists pgcrypto;

-- Keep compatibility with projects that use `listings`
alter table if exists public.listings
add column if not exists status text default 'available',
add column if not exists buyer_id uuid references auth.users(id),
add column if not exists purchased_at timestamptz;

-- DormGlide app currently stores listings in `products`
alter table if exists public.products
add column if not exists status text default 'available',
add column if not exists buyer_id uuid references auth.users(id),
add column if not exists purchased_at timestamptz;

alter table if exists public.products drop constraint if exists products_status_check;
alter table if exists public.products
add constraint products_status_check check (status in ('available', 'pending', 'sold', 'active'));

alter table if exists public.listings drop constraint if exists listings_status_check;
alter table if exists public.listings
add constraint listings_status_check check (status in ('available', 'pending', 'sold', 'active'));

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.products(id) on delete cascade,
  buyer_id uuid references auth.users(id),
  seller_id uuid references auth.users(id),
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Backfill legacy status values before enforcing the new status check.
update public.purchase_requests
set status = 'accepted'
where status = 'confirmed';

alter table if exists public.purchase_requests drop constraint if exists purchase_requests_status_check;
alter table if exists public.purchase_requests
add constraint purchase_requests_status_check check (status in ('pending', 'accepted', 'declined'));

create index if not exists purchase_requests_listing_id_idx on public.purchase_requests(listing_id);
create index if not exists purchase_requests_buyer_id_idx on public.purchase_requests(buyer_id);
create index if not exists purchase_requests_seller_id_idx on public.purchase_requests(seller_id);

alter table public.purchase_requests enable row level security;

drop policy if exists "Buyer or seller can view their requests" on public.purchase_requests;
drop policy if exists "Buyer can create request" on public.purchase_requests;
drop policy if exists "Seller can update request" on public.purchase_requests;

create policy "Buyer or seller can view their requests"
on public.purchase_requests
for select
to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Buyer can create request"
on public.purchase_requests
for insert
to authenticated
with check (auth.uid() = buyer_id);

create policy "Seller can update request"
on public.purchase_requests
for update
to authenticated
using (auth.uid() = seller_id)
with check (auth.uid() = seller_id);
