-- DormGlide: Glyde Phase 3 — trust & polish
-- Run AFTER 13_glyde_services.sql. Idempotent.
--
-- Adds the "Looking for..." request board, a reports inbox, an admin
-- allowlist (a real DB boundary — never user_metadata), and two read-only
-- aggregate functions: provider_stats() and glyde_admin_counts().

-- 1) "Looking for..." request board (campus-scoped like products)
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  requester_name text null,
  category text not null,
  title text not null,
  details text null,
  budget_note text null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.service_requests add column if not exists requester_name text null;

alter table public.service_requests drop constraint if exists service_requests_category_check;
alter table public.service_requests add constraint service_requests_category_check
check (category in (
  'Tutoring & academic help','Hair & beauty','Tech help','Photography & video',
  'Moving & carrying help','Pet sitting & dog walking','Fitness & sports coaching',
  'Music lessons','Other'
));

alter table public.service_requests drop constraint if exists service_requests_status_check;
alter table public.service_requests add constraint service_requests_status_check
check (status in ('open', 'closed'));

create index if not exists service_requests_school_status_idx
  on public.service_requests (school_id, status, created_at desc);

drop trigger if exists trg_service_requests_set_school on public.service_requests;
create trigger trg_service_requests_set_school
before insert on public.service_requests
for each row execute function public.set_row_school_id();

alter table public.service_requests enable row level security;

drop policy if exists "service_requests_select_campus" on public.service_requests;
create policy "service_requests_select_campus"
on public.service_requests for select to authenticated
using (school_id = public.current_school_id());

drop policy if exists "service_requests_insert_own" on public.service_requests;
create policy "service_requests_insert_own"
on public.service_requests for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "service_requests_update_own" on public.service_requests;
create policy "service_requests_update_own"
on public.service_requests for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "service_requests_delete_own" on public.service_requests;
create policy "service_requests_delete_own"
on public.service_requests for delete to authenticated
using (auth.uid() = user_id);

-- 2) Reports: clients may only insert their own. Nobody reads them from
--    the client; the founder reads via SQL Editor / admin function.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null,
  details text null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
check (target_type in ('listing', 'user', 'request'));

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
check (reason in ('Not allowed on Glyde', 'Scam or no-show', 'Harassment', 'Wrong category', 'Other'));

create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

drop trigger if exists trg_reports_set_school on public.reports;
create trigger trg_reports_set_school
before insert on public.reports
for each row execute function public.set_row_school_id();

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
on public.reports for insert to authenticated
with check (auth.uid() = reporter_id);
-- (no select/update/delete policies on purpose)

-- 3) Admin allowlist (server-side truth for founder-only reads)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- (no client policies)

insert into public.admin_users (user_id)
select id from auth.users where email = 'yamagu_k1@denison.edu'
on conflict (user_id) do nothing;

-- 4) provider_stats(): aggregates only, never message content.
create or replace function public.provider_stats(p_provider uuid)
returns table (
  completed_bookings integer,
  avg_rating numeric,
  rating_count integer,
  categories text[],
  reply_minutes numeric,
  reply_samples integer
)
language sql
stable
security definer
set search_path = public
as $$
  with completed as (
    select count(*)::int as n from public.purchase_requests
    where seller_id = p_provider and kind = 'booking' and status = 'completed'
  ),
  ratings as (
    select round(avg(rating)::numeric, 1) as avg_r, count(*)::int as n
    from public.seller_ratings where seller_id = p_provider
  ),
  cats as (
    select coalesce(array_agg(distinct service_category order by service_category), '{}') as arr
    from public.products
    where seller_id = p_provider and listing_type = 'service' and status <> 'sold'
  ),
  recent_convos as (
    select id from public.conversations
    where participant_a = p_provider or participant_b = p_provider
    order by coalesce(last_message_at, created_at) desc
    limit 20
  ),
  gaps as (
    select extract(epoch from (r.created_at - m.created_at)) / 60.0 as minutes
    from public.messages m
    join recent_convos rc on rc.id = m.conversation_id
    join lateral (
      select created_at from public.messages r
      where r.conversation_id = m.conversation_id
        and r.sender_id = p_provider
        and r.created_at > m.created_at
      order by r.created_at asc limit 1
    ) r on true
    where m.receiver_id = p_provider and m.sender_id <> p_provider
  ),
  reply as (
    select percentile_cont(0.5) within group (order by minutes) as med, count(*)::int as n from gaps
  )
  select completed.n, ratings.avg_r, ratings.n, cats.arr,
         case when reply.n >= 3 then round(reply.med::numeric, 0) else null end,
         reply.n
  from completed, ratings, cats, reply;
$$;

grant execute on function public.provider_stats(uuid) to authenticated;

-- 5) glyde_admin_counts(): founder-only aggregates
create or replace function public.glyde_admin_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'services', (select count(*) from public.products where listing_type = 'service'),
    'bookings_requested', (select count(*) from public.purchase_requests where kind = 'booking'),
    'bookings_completed', (select count(*) from public.purchase_requests where kind = 'booking' and status = 'completed'),
    'open_requests', (select count(*) from public.service_requests where status = 'open'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'by_category', (
      select coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) from (
        select p.service_category as category,
               count(distinct p.id) as services,
               count(pr.id) filter (where pr.kind = 'booking') as bookings_requested,
               count(pr.id) filter (where pr.kind = 'booking' and pr.status = 'completed') as bookings_completed
        from public.products p
        left join public.purchase_requests pr on pr.listing_id = p.id
        where p.listing_type = 'service'
        group by p.service_category
        order by services desc
      ) c
    ),
    'recent_reports', (
      select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) from (
        select id, target_type, target_id, reason, left(coalesce(details, ''), 120) as details, created_at
        from public.reports where status = 'open' order by created_at desc limit 20
      ) r
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.glyde_admin_counts() to authenticated;
