-- Task 2.2b, migration add_images_bucket: barber photos in a public bucket,
-- written only by members of the barbershop that owns the folder.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

select is(
  (select public::text || ':' || file_size_limit || ':' || array_to_string(allowed_mime_types, ',')
   from storage.buckets where id = 'images'),
  'true:262144:image/webp,image/jpeg',
  'the images bucket is public, up to 256 KB, WebP or JPEG'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Sede B', 'sede-b', current_date + 10, current_date + 10);
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233', false),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244', false),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', null, true);
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');
insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Ana', repeat('a', 64));

-- The owner of A uploads in A ------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp')$$,
  'an owner uploads a photo in their barbershop folder'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/22222222-2222-4222-8222-222222222222.jpg')$$,
  'a JPEG too'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'bbbbbbbb-0000-0000-0000-000000000000/barbers/33333333-3333-4333-8333-333333333333.webp')$$,
  '42501', null, 'not in the folder of another barbershop'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/otros/44444444-4444-4444-8444-444444444444.webp')$$,
  '42501', null, 'not in a kind of folder that does not exist'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/foto.png')$$,
  '42501', null, 'not with a name that can be guessed or another format'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/x/55555555-5555-4555-8555-555555555555.webp')$$,
  '42501', null, 'not in a subfolder'
);

-- A barber photo points into its own folder -------------------------------------------------

select lives_ok(
  $$update public.barbers set photo_path = 'aaaaaaaa-0000-0000-0000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp'
    where id = 'a1000000-0000-0000-0000-000000000000'$$,
  'a barber gets a photo of their barbershop'
);
select throws_ok(
  $$update public.barbers set photo_path = 'bbbbbbbb-0000-0000-0000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp'
    where id = 'a1000000-0000-0000-0000-000000000000'$$,
  '23514', null, 'never one from another barbershop folder'
);

-- B sees nothing of A ------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(
  (select count(*)::int from storage.objects where bucket_id = 'images'),
  0, 'the owner of B does not list the files of A'
);
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'images';
reset storage.allow_delete_query;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/66666666-6666-4666-8666-666666666666.webp')$$,
  '42501', null, 'a super admin cannot upload'
);

reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'images'),
  2, 'the owner of B deleted nothing of A'
);

-- No updates, and anonymous visitors list nothing ----------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  (select count(*)::int from storage.objects where bucket_id = 'images'),
  2, 'the owner of A lists their files'
);
update storage.objects set name = 'aaaaaaaa-0000-0000-0000-000000000000/barbers/77777777-7777-4777-8777-777777777777.webp'
where bucket_id = 'images';
reset role;
select is(
  (select count(*)::int from storage.objects where name like '%77777777%'),
  0, 'files are never renamed or overwritten'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
set local storage.allow_delete_query = 'true';
delete from storage.objects
where name = 'aaaaaaaa-0000-0000-0000-000000000000/barbers/22222222-2222-4222-8222-222222222222.jpg';
reset storage.allow_delete_query;
reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'images'),
  1, 'the owner of A deletes a replaced photo'
);

set local role anon;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'images'),
  0, 'anon lists no file'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/88888888-8888-4888-8888-888888888888.webp')$$,
  '42501', null, 'anon uploads nothing'
);

select * from finish();
rollback;
