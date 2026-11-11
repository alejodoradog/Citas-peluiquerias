-- Task 2.6, migration make_create_barbershop_idempotent: an owner with two
-- sedes. With two memberships there is no session default for barbershop_id,
-- so every write of the panel names its sede; the owner works on both and on
-- no one else's. "Nueva sede" creates one barbershop per request id, however
-- many times the same request arrives.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

select has_function(
  'public', 'create_barbershop', array['text', 'text', 'text', 'uuid'],
  'create_barbershop takes the request id'
);
select has_table('private', 'barbershop_creations', 'the request ids are kept in private');
select ok(
  (select relrowsecurity from pg_class where oid = 'private.barbershop_creations'::regclass),
  'barbershop_creations has RLS on'
);
select ok(
  not has_table_privilege('authenticated', 'private.barbershop_creations', 'SELECT, INSERT, UPDATE, DELETE')
    and not has_table_privilege('anon', 'private.barbershop_creations', 'SELECT, INSERT, UPDATE, DELETE'),
  'no session role reads or writes barbershop_creations'
);

-- Fixtures, inserted as the table owner ------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com');
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede Norte', 'sede-norte-a', current_date + 10, current_date + 10),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sede Sur', 'sede-sur-a', current_date + 10, current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Sede B', 'sede-b', current_date + 10, current_date + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233'),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('5e000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte Norte', 25000, 40),
  ('5e000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Corte B', 25000, 40);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ana Sur', repeat('a', 64));

-- The owner of two sedes ------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select private.current_barbershop_id()), null::uuid,
  'with two sedes there is no session barbershop'
);
select throws_ok(
  $$insert into public.services (name, price_cop, duration_minutes) values ('Sin sede', 20000, 30)$$,
  '42501', null,
  'so a write that does not name its sede fails'
);
select lives_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Tinte', 45000, 60)$$,
  'a write that names the second sede lands there'
);
select throws_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'Intruso', 1000, 30)$$,
  '42501', null,
  'and one that names another owner''s barbershop fails'
);
select lives_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000001',
      '[{"weekday": 1, "start": "09:00", "end": "18:00"}]')$$,
  'the owner sets the hours of the second sede'
);
select throws_ok(
  $$select public.set_barbershop_hours('bbbbbbbb-0000-0000-0000-000000000000',
      '[{"weekday": 1, "start": "09:00", "end": "18:00"}]')$$,
  '42501', null,
  'but not of another owner''s barbershop'
);
select lives_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000001', '[]',
      '[{"key": "s1", "name": "Corte", "price_cop": 25000, "duration_minutes": 40}]',
      '[{"display_name": "Dueño A", "email": null, "is_owner": true, "service_keys": ["s1"]}]')$$,
  'the owner finishes the setup wizard of the second sede'
);
select is(
  (select array_agg(barbershop_id::text order by barbershop_id) from public.services where name = 'Corte'),
  array['aaaaaaaa-0000-0000-0000-000000000001'],
  'the wizard wrote to the second sede only'
);
select throws_ok(
  $$select public.set_service_barbers('5e000000-0000-0000-0000-00000000000a',
      array['ba000000-0000-0000-0000-000000000001']::uuid[])$$,
  'P0002', null,
  'a service of one sede cannot take a barber of the other'
);
select throws_ok(
  $$select public.set_service_barbers('5e000000-0000-0000-0000-00000000000b', '{}')$$,
  'P0002', null,
  'nor can the owner touch a service of another owner'
);
select is(
  (select array_agg(distinct barbershop_id::text order by barbershop_id::text) from public.services),
  array['aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001'],
  'the owner reads the services of both sedes and of no one else'
);
select lives_ok(
  $$update public.barbershops set name = 'Tomada' where id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'an update of another owner''s barbershop runs'
);

reset role;
select is(
  (select name from public.barbershops where id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  'Sede B',
  'but changes nothing'
);

-- Nueva sede, once per request id ---------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$select public.create_barbershop('Sede Centro', 'sede-centro-a', null, '11111111-0000-4000-8000-000000000001')$$,
  'the owner creates a third sede'
);
select is(
  public.create_barbershop('Sede Centro', 'sede-centro-a', null, '11111111-0000-4000-8000-000000000001'),
  (select id from public.barbershops where slug = 'sede-centro-a'),
  'the same request again (a double tap) returns the same sede'
);
select is(
  public.create_barbershop('Sede Centro', 'sede-centro-a-2', null, '11111111-0000-4000-8000-000000000001'),
  (select id from public.barbershops where slug = 'sede-centro-a'),
  'even when the retry came with another link'
);
select is(
  (select count(*)::int from public.barbershops where slug like 'sede-centro-a%'),
  1,
  'so only one sede exists'
);
select is(
  (select count(*)::int from public.memberships
   where barbershop_id = (select id from public.barbershops where slug = 'sede-centro-a')),
  1,
  'with one membership'
);
select throws_ok(
  $$select public.create_barbershop('Repetida', 'sede-centro-a', null, '11111111-0000-4000-8000-000000000002')$$,
  '23505', null,
  'a new request with a taken link fails'
);
select lives_ok(
  $$select public.create_barbershop('Repetida', 'sede-repetida-a', null, '11111111-0000-4000-8000-000000000002')$$,
  'and its retry with a free link creates the sede, since the failure kept nothing'
);
select throws_ok(
  $$select * from private.barbershop_creations$$,
  '42501', null,
  'the owner cannot read the request ids'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$select public.create_barbershop('Ajena', 'sede-ajena-b', null, '11111111-0000-4000-8000-000000000001')$$,
  '42501', 'not allowed',
  'another owner replaying a request id learns nothing and creates nothing'
);
select is(
  (select count(*)::int from public.barbershops where slug = 'sede-ajena-b'),
  0,
  'nothing was created for them'
);
select ok(
  not exists (select 1 from public.barbershops where slug = 'sede-centro-a'),
  'and they still cannot see the other owner''s sede'
);

set local role anon;
set local request.jwt.claims to '';
select throws_ok(
  $$select public.create_barbershop('Anónima', 'sede-anonima', null, '11111111-0000-4000-8000-000000000003')$$,
  '42501', null,
  'anon cannot call create_barbershop'
);

reset role;
select is(
  (select count(*)::int from private.barbershop_creations),
  2,
  'one request id per sede created'
);

select * from finish();
rollback;
