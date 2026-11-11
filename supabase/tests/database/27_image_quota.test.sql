-- Security review of task 2.4, migration add_image_upload_tickets: an image
-- is uploaded (or its URL signed) only on a path reserved first with
-- reserve_image_upload, which holds the quota of the barbershop (2 per barber
-- plus 10). A reservation counts until its ticket expires, with or without
-- its object; objects count always.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

-- The code and the hint of the error a statement raises, or 'ok'. It runs as
-- the table owner with the claims of the test: reserve_image_upload is
-- security definer and reads the caller from the claims, and pgTAP's
-- throws_ok cannot read the hint.
create function pg_temp.error_of(statement text)
returns text
language plpgsql
as $$
declare
  state text;
  the_hint text;
begin
  execute statement;
  return 'ok';
exception when others then
  get stacked diagnostics state = returned_sqlstate, the_hint = pg_exception_hint;
  return state || ' ' || coalesce(nullif(the_hint, ''), '-');
end;
$$;

-- Structure and privileges ----------------------------------------------------------------

select has_table('private', 'image_upload_tickets', 'the tickets live in private');
select ok(
  (select relrowsecurity from pg_class where oid = 'private.image_upload_tickets'::regclass),
  'with RLS on as a second wall'
);
select ok(
  not has_table_privilege('authenticated', 'private.image_upload_tickets', 'SELECT')
    and not has_table_privilege('authenticated', 'private.image_upload_tickets', 'INSERT')
    and not has_table_privilege('authenticated', 'private.image_upload_tickets', 'UPDATE')
    and not has_table_privilege('authenticated', 'private.image_upload_tickets', 'DELETE')
    and not has_table_privilege('anon', 'private.image_upload_tickets', 'SELECT')
    and not has_table_privilege('anon', 'private.image_upload_tickets', 'INSERT'),
  'no session role touches the tickets'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.reserve_image_upload(text)'::regprocedure),
  'reserve_image_upload is security definer with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.reserve_image_upload(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.reserve_image_upload(text)', 'EXECUTE'),
  'only signed-in accounts may reserve'
);
select hasnt_function('private', 'images_under_quota', array['text'], 'the old quota, checked when signing, is gone');
select is(
  (select with_check from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname = 'images_member_insert')
    ~ 'has_upload_ticket\(name\)',
  true,
  'the insert policy asks for a ticket of the path'
);

-- Fixtures, inserted as the table owner ------------------------------------------------
-- A has one barber: a quota of 2 * 1 + 10 = 12 images. D is a deleted sede
-- that, against every rule, still has a membership of A: deleted_at alone
-- must stop it.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Sede B', 'sede-b', current_date + 10, current_date + 10),
  ('dddddddd-0000-0000-0000-000000000000', 'Sede D', 'sede-d', current_date + 10, current_date + 10);
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233', false),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244', false),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', null, true);
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-000000000000', 'owner');
update public.barbershops
set deleted_at = now(), deleted_by = '00000000-0000-0000-0000-00000000000a'
where id = 'dddddddd-0000-0000-0000-000000000000';
insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Ana', repeat('a', 64));

-- No ticket, no upload ---------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/00000000-0000-4000-8000-000000000000.webp')$$,
  '42501', null,
  'an upload (or a signature) without a reservation is refused, even in the own folder'
);
select lives_ok(
  $$select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp')$$,
  'the owner reserves a path of their barbershop'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp')$$,
  'and uploads to it'
);
select throws_ok(
  $$insert into private.image_upload_tickets (path, barbershop_id, expires_at)
    values ('aaaaaaaa-0000-0000-0000-000000000000/logo/12121212-1212-4121-8121-121212121212.webp',
            'aaaaaaaa-0000-0000-0000-000000000000', now() + interval '1 day')$$,
  '42501', null,
  'a session cannot write a ticket itself'
);

-- The same path twice is one ticket
select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/logo/22222222-2222-4222-8222-222222222222.webp');
select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/logo/22222222-2222-4222-8222-222222222222.webp');

-- A ticket past its signing window no longer opens the path
select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/cover/33333333-3333-4333-8333-333333333333.jpg');

reset role;
select is(
  (select count(*)::int from private.image_upload_tickets
   where path = 'aaaaaaaa-0000-0000-0000-000000000000/logo/22222222-2222-4222-8222-222222222222.webp'),
  1,
  'reserving the same path again renews its ticket instead of adding one'
);
update private.image_upload_tickets
set created_at = now() - interval '6 minutes'
where path = 'aaaaaaaa-0000-0000-0000-000000000000/cover/33333333-3333-4333-8333-333333333333.jpg';

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/cover/33333333-3333-4333-8333-333333333333.jpg')$$,
  '42501', null,
  'a ticket reserved more than 5 minutes ago signs nothing'
);
select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/cover/33333333-3333-4333-8333-333333333333.jpg');
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/cover/33333333-3333-4333-8333-333333333333.jpg')$$,
  'reserving it again opens it again'
);

-- Other barbershops, malformed paths, other roles ---------------------------------------

select throws_ok(
  $$select public.reserve_image_upload('bbbbbbbb-0000-0000-0000-000000000000/barbers/44444444-4444-4444-8444-444444444444.webp')$$,
  '42501', null,
  'no reservation in the folder of another barbershop'
);
select throws_ok(
  $$select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/barbers/foto.png')$$,
  '42501', null,
  'nor on a path that is not an image key'
);
select throws_ok(
  $$select public.reserve_image_upload(null)$$,
  '42501', null,
  'nor on no path'
);
select throws_ok(
  $$select public.reserve_image_upload('dddddddd-0000-0000-0000-000000000000/logo/55555555-5555-4555-8555-555555555555.webp')$$,
  '42501', null,
  'nor in a deleted sede, even with a membership left by mistake'
);

reset role;
insert into private.image_upload_tickets (path, barbershop_id, expires_at) values
  ('dddddddd-0000-0000-0000-000000000000/logo/55555555-5555-4555-8555-555555555555.webp',
   'dddddddd-0000-0000-0000-000000000000', now() + interval '1 day');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'dddddddd-0000-0000-0000-000000000000/logo/55555555-5555-4555-8555-555555555555.webp')$$,
  '42501', null,
  'and a deleted sede takes no upload, even with a ticket'
);

-- A reserves a path; B cannot use that ticket nor learn it exists.
select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/barbers/66666666-6666-4666-8666-666666666666.webp');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/66666666-6666-4666-8666-666666666666.webp')$$,
  '42501', null,
  'the owner of B cannot upload with a ticket of A'
);
select is(
  private.has_upload_ticket('aaaaaaaa-0000-0000-0000-000000000000/barbers/66666666-6666-4666-8666-666666666666.webp'),
  false,
  'nor learn that A reserved it'
);

reset role;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select is(
  pg_temp.error_of($$select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/logo/77777777-7777-4777-8777-777777777777.webp')$$),
  '42501 -',
  'a super admin reserves nothing'
);

set local role anon;
select throws_ok(
  $$select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/logo/77777777-7777-4777-8777-777777777777.webp')$$,
  '42501', null,
  'anon reserves nothing'
);
reset role;

-- The quota: 12 for A ---------------------------------------------------------------------
-- Used so far: two objects with their tickets (barbers/1111, cover/3333) and
-- two tickets without an object (logo/2222, barbers/6666).

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.reserve_image_upload(
      'aaaaaaaa-0000-0000-0000-000000000000/barbers/' || gen_random_uuid() || '.webp')
    from generate_series(1, 8)$$,
  'a barbershop reserves up to its quota, tickets without an object included'
);
reset role;
select is(
  pg_temp.error_of($$select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/barbers/88888888-8888-4888-8888-888888888888.webp')$$),
  '23514 image_quota',
  'and not one more'
);
select is(
  pg_temp.error_of($$select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/logo/22222222-2222-4222-8222-222222222222.webp')$$),
  'ok',
  'reserving a path already counted takes no new room (a retried request)'
);
select is(
  pg_temp.error_of($$select public.reserve_image_upload('bbbbbbbb-0000-0000-0000-000000000000/barbers/99999999-9999-4999-8999-999999999999.webp')$$),
  '42501 -',
  'the quota of A gives A nothing in B'
);

-- Deleting an object does not free its path while its ticket lives: a URL
-- signed with it could write the path again.
set local storage.allow_delete_query = 'true';
delete from storage.objects
where name = 'aaaaaaaa-0000-0000-0000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp';
reset storage.allow_delete_query;
select is(
  pg_temp.error_of($$select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/barbers/88888888-8888-4888-8888-888888888888.webp')$$),
  '23514 image_quota',
  'a deleted image keeps counting until its ticket expires'
);

-- Expired tickets count no more and are cleaned up. Every ticket of A but
-- cover/3333 (which has its object) expires.
update private.image_upload_tickets
set created_at = now() - interval '27 hours', expires_at = now() - interval '1 hour'
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'
  and path <> 'aaaaaaaa-0000-0000-0000-000000000000/cover/33333333-3333-4333-8333-333333333333.jpg';
select is(
  pg_temp.error_of($$select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/barbers/88888888-8888-4888-8888-888888888888.webp')$$),
  'ok',
  'expired tickets do not count'
);
select is(
  (select count(*)::int from private.image_upload_tickets
   where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  2,
  'and the reservation deletes them'
);

-- Objects count even without a ticket (images from before this migration):
-- with cover/3333, the ticket of barbers/8888 and 10 old images, A is full.
insert into storage.objects (bucket_id, name)
select 'images', 'aaaaaaaa-0000-0000-0000-000000000000/barbers/' || gen_random_uuid() || '.webp'
from generate_series(1, 10);
select is(
  pg_temp.error_of($$select public.reserve_image_upload('aaaaaaaa-0000-0000-0000-000000000000/logo/abababab-abab-4bab-8bab-abababababab.webp')$$),
  '23514 image_quota',
  'objects without a ticket count too'
);

select * from finish();
rollback;
