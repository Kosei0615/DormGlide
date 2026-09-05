-- DormGlide: listing photo storage
-- Run AFTER 08_deal_flow.sql. Idempotent.
--
-- Moves listing photos out of base64-in-the-database into a Supabase Storage
-- bucket. products.images text[] keeps holding the ordered URLs (first = cover);
-- only what the array contains changes.

-- 1) Bucket: public read, 2MB cap per file (client compresses to ~200KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 2) Storage RLS: anyone can view; users write/delete only inside their own
--    {user_id}/ folder.
drop policy if exists "listing_photos_public_read" on storage.objects;
create policy "listing_photos_public_read"
on storage.objects for select
to public
using (bucket_id = 'listing-photos');

drop policy if exists "listing_photos_owner_insert" on storage.objects;
create policy "listing_photos_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "listing_photos_owner_delete" on storage.objects;
create policy "listing_photos_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
