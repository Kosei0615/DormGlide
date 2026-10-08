-- 23: Featured courier media + ordering. Idempotent.
-- photo_url / video_url: public URLs (repo brand/ folder or Storage) shown in
-- the "Meet your courier" section on Glyde. sort_order: which courier is
-- featured first when there are several.
alter table public.delivery_providers add column if not exists photo_url text null;
alter table public.delivery_providers add column if not exists video_url text null;
alter table public.delivery_providers add column if not exists sort_order integer not null default 0;
