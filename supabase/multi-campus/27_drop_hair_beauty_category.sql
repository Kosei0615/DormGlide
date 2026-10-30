-- 27: Remove 'Hair & beauty' from the Glyde service categories. Idempotent.
-- Why: the Denison Student Residence Agreement does not allow running a shop
-- out of a residence hall room (hair, nails, lashes, tattoos, cooking for
-- sale). The category is already gone from js/utils/glyde.js (v5); this
-- tightens the DB check constraint to match. No listing used the category
-- when this was written (0 rows), so no data moves.

update public.products set service_category = 'Other'
 where listing_type = 'service' and service_category = 'Hair & beauty';

alter table public.products drop constraint if exists products_service_category_check;
alter table public.products add constraint products_service_category_check
  check (service_category is null or service_category = any (array[
    'Tutoring & academic help', 'Tech help', 'Photography & video', 'Moving & carrying help',
    'Rides & errands', 'Pet sitting & dog walking', 'Fitness & sports coaching', 'Music lessons', 'Other'
  ]::text[]));
