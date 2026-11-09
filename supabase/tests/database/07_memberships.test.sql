-- Task 1.9, migration add_memberships (decision 0006): one account can run
-- several barbershops through memberships, and RLS follows the memberships.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

select has_table('public', 'memberships', 'memberships exists');
select hasnt_column('public', 'profiles', 'role', 'profiles no longer carries the role');
select hasnt_column('public', 'profiles', 'barbershop_id', 'profiles no longer carries the barbershop');
select has_column('public', 'profiles', 'is_super_admin', 'profiles marks the super admin');

-- Fixtures, inserted as the table owner -------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'owner-c@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A1', 'sede-a1', current_date + 20),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Sede A2', 'sede-a2', current_date + 20),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Sede B', 'sede-b', current_date + 20),
  ('cccccccc-0000-0000-0000-000000000000', 'Sede C', 'sede-c', current_date + 20);

insert into public.profiles (id, full_name, active, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', true, false),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', true, false),
  ('00000000-0000-0000-0000-00000000000c', 'Dueño C', false, false),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', true, true);

insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000000', 'owner');

insert into public.services (barbershop_id, name, price_cop, duration_minutes) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Corte A1', 25000, 40),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Corte A2', 25000, 40),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Corte B', 30000, 40);

select throws_ok(
  $$insert into public.memberships (user_id, barbershop_id, role) values
      ('00000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner')$$,
  '23505', null,
  'a barbershop has a single owner'
);

-- An owner with two barbershops ------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$select slug from public.barbershops
    where slug in ('sede-a1', 'sede-a2', 'sede-b', 'sede-c') order by slug$$,
  $$values ('sede-a1'), ('sede-a2')$$,
  'an owner with two barbershops sees both and no other'
);
select results_eq(
  $$select name from public.services
    where name in ('Corte A1', 'Corte A2', 'Corte B') order by name$$,
  $$values ('Corte A1'), ('Corte A2')$$,
  'an owner reads the services of both barbershops and not of a third'
);
select results_eq(
  $$select barbershop_id::text from public.memberships order by 1$$,
  $$values ('aaaaaaaa-0000-0000-0000-000000000000'), ('aaaaaaaa-0000-0000-0000-000000000002')$$,
  'an owner reads only their own memberships'
);
select throws_ok(
  $$insert into public.services (name, price_cop, duration_minutes) values ('Sin sede', 1000, 20)$$,
  '42501', null,
  'with two barbershops there is no default barbershop_id, so the insert fails'
);
select lives_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'Barba A2', 15000, 20)$$,
  'naming one of their barbershops, the insert works'
);
select throws_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'Intruso', 1000, 20)$$,
  '42501', null,
  'an owner cannot write into a barbershop that is not theirs'
);
select throws_ok(
  $$insert into public.memberships (user_id, barbershop_id, role) values
      ('00000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner')$$,
  '42501', null,
  'nobody can give themselves a membership'
);
select throws_ok(
  $$delete from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'nobody can delete a membership'
);

-- A single barbershop keeps its default ----------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select lives_ok(
  $$insert into public.services (name, price_cop, duration_minutes) values ('Barba B', 15000, 20)$$,
  'an owner with one barbershop still gets the default barbershop_id'
);

-- An inactive profile sees nothing ------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is_empty(
  $$select id from public.barbershops where slug = 'sede-c'$$,
  'an inactive owner does not see their barbershop'
);

-- The super admin reads every membership ----------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';

select is(
  (select count(*)::int from public.memberships where user_id in (
     '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
     '00000000-0000-0000-0000-00000000000c')),
  4,
  'the super admin reads every membership'
);

reset role;
set local request.jwt.claims to '';

-- Signup creates the owner membership --------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-0000000000a1', 'nuevo@example.com',
  '{"owner_name": "Nuevo", "barbershop_name": "Nueva", "barbershop_slug": "nueva-sede", "phone": "+573001234567"}'
);

select is(
  (select m.role::text from public.memberships m
   join public.barbershops b on b.id = m.barbershop_id
   where m.user_id = '00000000-0000-0000-0000-0000000000a1' and b.slug = 'nueva-sede'),
  'owner',
  'signup creates the owner membership of the new barbershop'
);
select is(
  (select is_super_admin from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  false,
  'a signup is never a super admin'
);

select * from finish();
rollback;
