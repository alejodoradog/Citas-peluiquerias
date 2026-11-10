-- Task 2.4d, migration add_barbershop_profile_rules (D-57, Datos y fotos):
-- the logo and the cover live in their own folder of their own barbershop,
-- "Barrio y ciudad" (locality) and the address have a length, anon reads the
-- locality but nobody but a member writes it.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com');
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Sede B', 'sede-b', current_date + 10, current_date + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner');
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, is_owner, link_active) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Dueño', repeat('a', 64), true, false);

-- Columns and privileges --------------------------------------------------------------------

select has_column('public', 'barbershops', 'locality', 'barbershops keeps "Barrio y ciudad"');
select ok(
  has_column_privilege('anon', 'public.barbershops', 'locality', 'SELECT'),
  'the booking page reads the locality'
);
select ok(
  not has_column_privilege('anon', 'public.barbershops', 'locality', 'UPDATE')
  and not has_column_privilege('anon', 'public.barbershops', 'locality', 'INSERT'),
  'anon never writes it'
);
select ok(
  has_column_privilege('authenticated', 'public.barbershops', 'locality', 'UPDATE'),
  'a session updates it, in its own barbershops (member_update)'
);
select ok(
  has_function_privilege('authenticated', 'private.is_image_key(text)', 'EXECUTE')
  and has_function_privilege('service_role', 'private.is_image_key(text)', 'EXECUTE'),
  'whoever writes barbershops may run the check of its images'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- The logo -------------------------------------------------------------------------------------

select lives_ok(
  $$update public.barbershops
    set logo_path = 'aaaaaaaa-0000-0000-0000-000000000000/logo/11111111-1111-4111-8111-111111111111.webp'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'the owner sets a logo in the logo folder of the barbershop'
);
select throws_ok(
  $$update public.barbershops
    set logo_path = 'bbbbbbbb-0000-0000-0000-000000000000/logo/11111111-1111-4111-8111-111111111111.webp'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'not a logo of another barbershop'
);
select throws_ok(
  $$update public.barbershops
    set logo_path = 'aaaaaaaa-0000-0000-0000-000000000000/barbers/22222222-2222-4222-8222-222222222222.webp'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'nor the photo of a barber, which removing the logo would delete'
);
select throws_ok(
  $$update public.barbershops
    set logo_path = 'aaaaaaaa-0000-0000-0000-000000000000/cover/33333333-3333-4333-8333-333333333333.webp'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'nor the cover'
);
select throws_ok(
  $$update public.barbershops
    set logo_path = 'aaaaaaaa-0000-0000-0000-000000000000/logo/logo.png'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'nor a name that can be guessed or another format'
);
select throws_ok(
  $$update public.barbershops
    set logo_path = 'aaaaaaaa-0000-0000-0000-000000000000/logo/../bbbbbbbb-0000-0000-0000-000000000000/logo/11111111-1111-4111-8111-111111111111.webp'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'nor a path that climbs out'
);
select is(
  (select logo_path from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'aaaaaaaa-0000-0000-0000-000000000000/logo/11111111-1111-4111-8111-111111111111.webp',
  'the logo stays as it was after every refusal'
);

-- The cover ------------------------------------------------------------------------------------

select lives_ok(
  $$update public.barbershops
    set cover_photo_path = 'aaaaaaaa-0000-0000-0000-000000000000/cover/44444444-4444-4444-8444-444444444444.jpg'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'the owner sets a cover in the cover folder of the barbershop'
);
select throws_ok(
  $$update public.barbershops
    set cover_photo_path = 'bbbbbbbb-0000-0000-0000-000000000000/cover/44444444-4444-4444-8444-444444444444.jpg'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'not a cover of another barbershop'
);
select throws_ok(
  $$update public.barbershops
    set cover_photo_path = 'aaaaaaaa-0000-0000-0000-000000000000/logo/11111111-1111-4111-8111-111111111111.webp'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'nor the logo, which the cover would then share'
);
select throws_ok(
  $$update public.barbershops
    set cover_photo_path = 'aaaaaaaa-0000-0000-0000-000000000000/barbers/22222222-2222-4222-8222-222222222222.webp'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'nor the photo of a barber'
);

-- And the other way round: a barber's photo is never the logo.
select throws_ok(
  $$update public.barbers
    set photo_path = 'aaaaaaaa-0000-0000-0000-000000000000/logo/11111111-1111-4111-8111-111111111111.webp'
    where id = 'a1000000-0000-0000-0000-000000000000'$$,
  '23514', null, 'a barber cannot take the logo as their photo'
);

-- Another barbershop: RLS hides its row, nothing changes.
update public.barbershops
set logo_path = 'bbbbbbbb-0000-0000-0000-000000000000/logo/55555555-5555-4555-8555-555555555555.webp',
    locality = 'Hackeada'
where id = 'bbbbbbbb-0000-0000-0000-000000000000';

-- Locality and address --------------------------------------------------------------------------

select lives_ok(
  $$update public.barbershops
    set locality = 'Chapinero, Bogotá', address = 'Cra. 15 # 82-40'
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'the owner writes the locality and the address'
);
select throws_ok(
  $$update public.barbershops set locality = '   ' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'a blank locality is empty, not a locality'
);
select throws_ok(
  $$update public.barbershops set locality = repeat('x', 101) where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'the locality has at most 100 characters'
);
select throws_ok(
  $$update public.barbershops set address = '' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'an empty address is null'
);
select throws_ok(
  $$update public.barbershops set address = repeat('x', 201) where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'the address has at most 200 characters'
);
select lives_ok(
  $$update public.barbershops
    set address = repeat('x', 200), locality = repeat('y', 100)
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'both at their longest'
);
select lives_ok(
  $$update public.barbershops
    set address = null, locality = null, logo_path = null, cover_photo_path = null
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'and all of them can be removed'
);

-- anon reads the locality, writes nothing ----------------------------------------------------------

reset role;
update public.barbershops set locality = 'Laureles, Medellín'
where id = 'aaaaaaaa-0000-0000-0000-000000000000';

set local role anon;
set local request.jwt.claims to '';

select is(
  (select locality from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'Laureles, Medellín',
  'the booking page reads it'
);
select throws_ok(
  $$update public.barbershops set locality = 'Hackeada' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '42501', null, 'anon cannot change it'
);

-- Server jobs -------------------------------------------------------------------------------------

reset role;
set local role service_role;

select lives_ok(
  $$update public.barbershops
    set logo_path = 'bbbbbbbb-0000-0000-0000-000000000000/logo/66666666-6666-4666-8666-666666666666.webp'
    where id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'service_role writes a valid logo (it may run private.is_image_key)'
);

reset role;

select is(
  (select coalesce(locality, '') from public.barbershops where id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  '',
  'the owner of A never wrote the row of B'
);

select * from finish();
rollback;
