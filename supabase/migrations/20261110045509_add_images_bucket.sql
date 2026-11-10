-- Task 2.2b, barber photos (D-54), and later the logo and cover of a
-- barbershop (task 2.4). Decision 0007: one public bucket for the images the
-- booking page shows; uploads go through a signed URL; keys cannot be guessed
-- (<barbershop_id>/<kind>/<uuid>.<webp|jpg>); a replaced image is deleted.
--
-- The images are public on purpose: the booking page shows them to anyone.
-- What stays private is the list of keys: anon has no policy on
-- storage.objects, so nobody can list a barbershop's files.

create function private.is_image_key(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(barbers|logo|cover)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
$$;

grant execute on function private.is_image_key(text) to authenticated;

-- 256 KB: photos are compressed in the browser to 400 px, under 100 KB.
-- Safari on the iPhone cannot encode WebP from a canvas, hence JPEG too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 262144, array['image/webp', 'image/jpeg']);

-- Members read, upload and delete in their barbershop's folder only. No
-- update: an image is replaced by a new key, never overwritten.
create policy images_member_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = any ((select private.member_barbershop_ids())::text[])
  );

create policy images_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'images'
    and private.is_image_key(name)
    and (storage.foldername(name))[1] = any ((select private.member_barbershop_ids())::text[])
  );

create policy images_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = any ((select private.member_barbershop_ids())::text[])
  );

-- A barber's photo lives in the barbers folder of its own barbershop.
alter table public.barbers
  add constraint barbers_photo_in_own_folder check (
    photo_path is null
    or (
      private.is_image_key(photo_path)
      and starts_with(photo_path, barbershop_id::text || '/barbers/')
    )
  );
