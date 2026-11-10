-- Task 2.3, migration add_barber_link_rules: when a barber's link was issued,
-- a link turned off comes back only with a new token, and the owner has none.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

select has_column('public', 'barbers', 'link_issued_at', 'barbers keeps when the link was issued');
select ok(
  has_column_privilege('authenticated', 'public.barbers', 'link_issued_at', 'SELECT'),
  'owners read when the link was issued'
);
select ok(
  not has_column_privilege('anon', 'public.barbers', 'link_issued_at', 'SELECT'),
  'anon does not'
);
select ok(
  not has_column_privilege('authenticated', 'public.barbers', 'link_issued_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.barbers', 'link_issued_at', 'INSERT'),
  'sessions never write it'
);
-- The app hashes tokens with SHA-256 in hex (src/lib/tokens/link-token.ts);
-- task 4.4 looks them up the same way.
select is(
  encode(sha256(convert_to('abc', 'UTF8')), 'hex'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'the database hashes a token like the app does'
);

-- Fixtures -------------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com');
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Sede B', 'sede-b', current_date + 10, current_date + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233'),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, is_owner, link_active) values
  ('a0000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Dueño', repeat('0', 64), true, false);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, link_issued_at) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Ana', repeat('a', 64), now()),
  ('a2000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Beto', repeat('b', 64), null),
  ('a3000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Dora', repeat('e', 64), null),
  ('b1000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Ciro', repeat('c', 64), null);

select ok(
  (select link_issued_at is null from public.barbers where id = 'a1000000-0000-0000-0000-000000000000'),
  'a new barber has no link issued, whatever the insert says'
);

-- Beto's and Dora's links were sent days ago. Only the trigger writes the
-- date, so it is set here with the trigger off, to tell "kept" from "stamped
-- again".
alter table public.barbers disable trigger guard_barber_link;
update public.barbers set link_issued_at = '2020-11-01 15:00:00+00'
where id in ('a2000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000000');
alter table public.barbers enable trigger guard_barber_link;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- Sessions cannot write the date -----------------------------------------------------------

select throws_ok(
  $$update public.barbers set link_issued_at = now() where id = 'a1000000-0000-0000-0000-000000000000'$$,
  '42501', null, 'an owner cannot set when a link was issued'
);
select throws_ok(
  $$insert into public.barbers (barbershop_id, display_name, link_token_hash, link_issued_at)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Raro', repeat('d', 64), now())$$,
  '42501', null, 'nor insert a barber with one'
);

-- Issuing a link stamps the date -------------------------------------------------------------

select lives_ok(
  $$update public.barbers set link_token_hash = repeat('1', 64), link_active = true
    where id = 'a1000000-0000-0000-0000-000000000000'$$,
  'the owner issues a new link'
);
select ok(
  (select link_issued_at = now() and link_active from public.barbers
   where id = 'a1000000-0000-0000-0000-000000000000'),
  'and the barber shows it was sent now'
);

-- Replacing a link that works stamps it again ---------------------------------------------------

select lives_ok(
  $$update public.barbers set link_token_hash = repeat('6', 64), link_active = true
    where id = 'a3000000-0000-0000-0000-000000000000'$$,
  'the owner replaces a link that works'
);
select ok(
  (select link_issued_at > '2020-11-01 15:00:00+00'::timestamptz and link_active
   from public.barbers where id = 'a3000000-0000-0000-0000-000000000000'),
  'and the barber shows the new one was sent later'
);

-- Anything else keeps it -------------------------------------------------------------------------

update public.barbers set display_name = 'Beto R.' where id = 'a2000000-0000-0000-0000-000000000000';
select is(
  (select link_issued_at from public.barbers where id = 'a2000000-0000-0000-0000-000000000000'),
  '2020-11-01 15:00:00+00'::timestamptz,
  'editing the barber keeps when the link was sent'
);
update public.barbers set link_active = false where id = 'a2000000-0000-0000-0000-000000000000';
select is(
  (select link_issued_at from public.barbers where id = 'a2000000-0000-0000-0000-000000000000'),
  '2020-11-01 15:00:00+00'::timestamptz,
  'turning the link off keeps it too'
);

-- A link turned off comes back only with a new token ----------------------------------------

select throws_ok(
  $$update public.barbers set link_active = true where id = 'a2000000-0000-0000-0000-000000000000'$$,
  '23514', null, 'a link turned off cannot be turned on again'
);
update public.barbers set link_token_hash = repeat('2', 64) where id = 'a2000000-0000-0000-0000-000000000000';
select is(
  (select link_issued_at from public.barbers where id = 'a2000000-0000-0000-0000-000000000000'),
  '2020-11-01 15:00:00+00'::timestamptz,
  'a token written while the link is off is not an issued link'
);
select throws_ok(
  $$update public.barbers set link_active = true where id = 'a2000000-0000-0000-0000-000000000000'$$,
  '23514', null, 'and it cannot turn the link on later'
);
select lives_ok(
  $$update public.barbers set link_token_hash = repeat('3', 64), link_active = true
    where id = 'a2000000-0000-0000-0000-000000000000'$$,
  'a new token in the same step brings the link back'
);
select ok(
  (select link_issued_at = now() and link_active from public.barbers
   where id = 'a2000000-0000-0000-0000-000000000000'),
  'stamped as sent now'
);

-- The owner has no link ---------------------------------------------------------------------------

select throws_ok(
  $$update public.barbers set link_token_hash = repeat('4', 64), link_active = true
    where id = 'a0000000-0000-0000-0000-000000000000'$$,
  '23514', null, 'the owner''s barber cannot get a link'
);

select throws_ok(
  $$insert into public.barbers (barbershop_id, display_name, link_token_hash, is_owner, link_active)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Otro dueño', repeat('7', 64), true, true)$$,
  '23514', null, 'nor can an owner''s barber be inserted with one'
);

-- Another barbershop's barber is out of reach ---------------------------------------------------

update public.barbers set link_token_hash = repeat('5', 64), link_active = true
where id = 'b1000000-0000-0000-0000-000000000000';
update public.barbers set link_active = false where id = 'b1000000-0000-0000-0000-000000000000';
select is(
  (select count(*)::int from public.barbers where id = 'b1000000-0000-0000-0000-000000000000'),
  0, 'owner A does not see the barber of B'
);

reset role;
select ok(
  (select link_active and link_token_hash = repeat('c', 64) and link_issued_at is null
   from public.barbers where id = 'b1000000-0000-0000-0000-000000000000'),
  'and changed nothing of their link'
);
select ok(
  not exists (select 1 from public.barbers where link_token_hash = repeat('e', 64))
  and exists (
    select 1 from public.barbers
    where id = 'a3000000-0000-0000-0000-000000000000' and link_token_hash = repeat('6', 64)
  ),
  'a replaced link''s hash is gone, so its token opens nothing'
);

-- Anonymous visitors -------------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '';
select throws_ok(
  'select link_issued_at from public.barbers',
  '42501', null, 'anon cannot read when a link was issued'
);
select throws_ok(
  $$update public.barbers set link_active = false where id = 'a1000000-0000-0000-0000-000000000000'$$,
  '42501', null, 'nor turn a link off'
);

select * from finish();
rollback;
