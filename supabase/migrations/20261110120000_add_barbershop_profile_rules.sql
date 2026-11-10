-- Task 2.4d, D-57 "Datos y fotos" (docs/tareas/2.4-configuracion.md).
--
-- 1. locality: the design's "Barrio y ciudad" ("Chapinero, Bogotá"), shown
--    on the booking page under the address (decision P3, provisional).
-- 2. The address gets a length, as the name already has one.
-- 3. The logo and the cover live in their own folder of their own
--    barbershop, as a barber's photo already does
--    (barbers_photo_in_own_folder). Replacing or removing them deletes the
--    file the row pointed at, so the row must never point at a file of
--    another barbershop, at a barber's photo, or the logo at the cover.
--    Since the folder starts with the row's own id, no two barbershops can
--    share a file either: no unique index is needed.
--
-- The checks call private.is_image_key, and a check runs with the privileges
-- of whoever writes the row. Who writes barbershops: sessions
-- (authenticated) and server jobs (service_role), which may already run it
-- (20261110045509, 20261110073000); and security definer functions
-- (register_owner_on_signup on auth.users, create_barbershop,
-- complete_barbershop_setup), which run as their owner. anon writes nothing.
--
-- The checks are validated when they are created: a row that breaks them
-- makes this migration fail instead of being hidden.

alter table public.barbershops
  add column locality text,
  add constraint barbershops_locality_length
    check (char_length(btrim(locality)) between 1 and 100),
  add constraint barbershops_address_length
    check (char_length(btrim(address)) between 1 and 200),
  add constraint barbershops_logo_in_own_folder check (
    logo_path is null
    or (
      private.is_image_key(logo_path)
      and starts_with(logo_path, id::text || '/logo/')
    )
  ),
  add constraint barbershops_cover_in_own_folder check (
    cover_photo_path is null
    or (
      private.is_image_key(cover_photo_path)
      and starts_with(cover_photo_path, id::text || '/cover/')
    )
  );

-- anon reads by column what the booking page shows; sessions update by
-- column what the panel edits (20261104162412). authenticated already reads
-- every column.
grant select (locality) on public.barbershops to anon;
grant update (locality) on public.barbershops to authenticated;
