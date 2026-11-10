-- Task 2.2b, after its security review (docs/tareas/2.2-servicios-y-barberos.md).
--
-- 1. A quota of images per barbershop: sign-up is open, so without it any
--    account could fill the public bucket and spend its egress.
-- 2. One photo belongs to one barber: replacing or removing a barber's photo
--    deletes the file, so two barbers must never point at the same one.
-- 3. The owner's barber is never deactivated, and sessions insert only the
--    barber columns the panel and the wizard set.

-- 1. Quota ---------------------------------------------------------------------------------
-- Two images per barber plus ten for the logo, the cover and replacements in
-- flight. Security definer: it counts objects the caller may not list, and it
-- only answers yes or no.

create function private.images_under_quota(folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from storage.objects o
    where o.bucket_id = 'images' and o.name like folder || '/%'
  ) < (
    select 2 * count(*) + 10 from public.barbers b
    where b.barbershop_id::text = folder
  )
$$;

grant execute on function private.images_under_quota(text) to authenticated;

drop policy images_member_insert on storage.objects;
create policy images_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'images'
    and private.is_image_key(name)
    and (storage.foldername(name))[1] = any ((select private.member_barbershop_ids())::text[])
    and private.images_under_quota((storage.foldername(name))[1])
  );

-- 2. One photo, one barber --------------------------------------------------------------------

create unique index barbers_photo_path_key on public.barbers (photo_path)
  where photo_path is not null;

-- 3. The owner stays active, and inserts by column ------------------------------------------

alter table public.barbers
  add constraint barbers_owner_stays_active check (not (is_owner and not active));

revoke insert on public.barbers from authenticated;
grant insert (
  barbershop_id, display_name, email, email_notifications, photo_path,
  sort_order, link_token_hash, link_active, uses_barbershop_hours, is_owner
) on public.barbers to authenticated;
