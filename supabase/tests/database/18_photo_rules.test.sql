-- Task 2.2b, migration add_photo_rules: an image quota per barbershop, one
-- photo per barber, and the owner's barber always active.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com');
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner');
-- The owner has no private link (barbers_owner_has_no_link, task 2.3).
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, is_owner, link_active) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Dueño', repeat('a', 64), true, false),
  ('a2000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Beto', repeat('b', 64), false, true);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- Quota: 2 barbers give 2 * 2 + 10 = 14 images ------------------------------------------------

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    select 'images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/' || gen_random_uuid() || '.webp'
    from generate_series(1, 14)$$,
  'a barbershop uploads up to its quota'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/99999999-9999-4999-8999-999999999999.webp')$$,
  '42501', null, 'and not one image more'
);

-- One photo, one barber ---------------------------------------------------------------------

update public.barbers
set photo_path = 'aaaaaaaa-0000-0000-0000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp'
where id = 'a1000000-0000-0000-0000-000000000000';
select throws_ok(
  $$update public.barbers
    set photo_path = 'aaaaaaaa-0000-0000-0000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp'
    where id = 'a2000000-0000-0000-0000-000000000000'$$,
  '23505', null, 'two barbers cannot share a photo'
);

-- The owner's barber stays active ----------------------------------------------------------------

select throws_ok(
  $$update public.barbers set active = false where id = 'a1000000-0000-0000-0000-000000000000'$$,
  '23514', null, 'the owner''s barber cannot be deactivated'
);
select lives_ok(
  $$update public.barbers set active = false where id = 'a2000000-0000-0000-0000-000000000000'$$,
  'another barber can'
);

-- Inserts by column ---------------------------------------------------------------------------------

select throws_ok(
  $$insert into public.barbers (barbershop_id, display_name, link_token_hash, active)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Inactivo', repeat('c', 64), false)$$,
  '42501', null, 'a session cannot insert a barber as inactive'
);
select throws_ok(
  $$insert into public.barbers (barbershop_id, display_name, link_token_hash, deactivated_at)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Raro', repeat('d', 64), now())$$,
  '42501', null, 'nor set the deactivation stamp'
);
select lives_ok(
  $$insert into public.barbers (barbershop_id, display_name, link_token_hash)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Nuevo', repeat('e', 64))$$,
  'a session inserts a barber with the panel columns'
);

select * from finish();
rollback;
