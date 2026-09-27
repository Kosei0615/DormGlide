-- 16: Add "Rides & errands" as a Glyde service category.
-- Idempotent. Widens the check constraint from migration 13; no data changes.
-- Pairs with Terms v1.2 (rides allowed with valid license + insured vehicle).

alter table public.products drop constraint if exists products_service_category_check;
alter table public.products add constraint products_service_category_check
check (
  service_category is null or service_category in (
    'Tutoring & academic help',
    'Hair & beauty',
    'Tech help',
    'Photography & video',
    'Moving & carrying help',
    'Rides & errands',
    'Pet sitting & dog walking',
    'Fitness & sports coaching',
    'Music lessons',
    'Other'
  )
);
