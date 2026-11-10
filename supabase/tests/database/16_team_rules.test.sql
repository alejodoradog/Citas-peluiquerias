-- Task 2.2, migration add_team_rules: services and barbers are deactivated,
-- never deleted; who does what and a barber's own hours change in one step.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

select has_column('public', 'barbers', 'deactivated_at', 'barbers keeps when it was deactivated');
select has_function('public', 'set_service_barbers', array['uuid', 'uuid[]'], 'set_service_barbers exists');
select has_function('public', 'set_barber_services', array['uuid', 'uuid[]'], 'set_barber_services exists');
select has_function('public', 'set_barber_schedule', array['uuid', 'boolean', 'jsonb'], 'set_barber_schedule exists');

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
insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Ana', repeat('a', 64)),
  ('a2000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Beto', repeat('b', 64)),
  ('b1000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Ciro', repeat('c', 64));
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5a100000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte', 25000, 40, true),
  ('5a200000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barba', 15000, 20, true),
  ('5a300000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Tinte', 40000, 60, false),
  ('5b100000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Corte B', 20000, 30, true);
-- Ana did Tinte before it was deactivated.
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', '5a300000-0000-0000-0000-000000000000');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 1, '09:00', '20:00');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- Barbers are deactivated, never deleted ---------------------------------------------------

select throws_ok(
  $$delete from public.barbers where id = 'a2000000-0000-0000-0000-000000000000'$$,
  '42501', null, 'an owner cannot delete a barber'
);
update public.barbers set active = false where id = 'a2000000-0000-0000-0000-000000000000';
select ok(
  (select deactivated_at is not null from public.barbers where id = 'a2000000-0000-0000-0000-000000000000'),
  'deactivating a barber stamps when'
);
update public.barbers set active = true where id = 'a2000000-0000-0000-0000-000000000000';
select ok(
  (select deactivated_at is null from public.barbers where id = 'a2000000-0000-0000-0000-000000000000'),
  'activating them again clears it'
);
select throws_ok(
  $$update public.barbers set deactivated_at = now() where id = 'a1000000-0000-0000-0000-000000000000'$$,
  '42501', null, 'the stamp is not written by hand'
);

-- Who does a service -----------------------------------------------------------------------

select lives_ok(
  $$select public.set_service_barbers('5a100000-0000-0000-0000-000000000000',
      array['a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000000']::uuid[])$$,
  'the owner sets who does a service'
);
select is(
  (select count(*)::int from public.barber_services where service_id = '5a100000-0000-0000-0000-000000000000'),
  2, 'both barbers do it'
);
select lives_ok(
  $$select public.set_service_barbers('5a100000-0000-0000-0000-000000000000',
      array['a1000000-0000-0000-0000-000000000000']::uuid[])$$,
  'and changes it'
);
select is(
  (select array_agg(barber_id) from public.barber_services where service_id = '5a100000-0000-0000-0000-000000000000'),
  array['a1000000-0000-0000-0000-000000000000'::uuid], 'the barber taken out no longer does it'
);
select throws_ok(
  $$select public.set_service_barbers('5a100000-0000-0000-0000-000000000000',
      array['b1000000-0000-0000-0000-000000000000']::uuid[])$$,
  'P0002', null, 'a barber of another barbershop cannot be given the service'
);
select throws_ok(
  $$select public.set_service_barbers('5b100000-0000-0000-0000-000000000000', '{}'::uuid[])$$,
  'P0002', null, 'a service of another barbershop cannot be changed'
);

-- What a barber does ------------------------------------------------------------------------

select lives_ok(
  $$select public.set_barber_services('a1000000-0000-0000-0000-000000000000',
      array['5a200000-0000-0000-0000-000000000000']::uuid[])$$,
  'the owner sets what a barber does'
);
select is(
  (select array_agg(service_id order by service_id) from public.barber_services where barber_id = 'a1000000-0000-0000-0000-000000000000'),
  array['5a200000-0000-0000-0000-000000000000'::uuid, '5a300000-0000-0000-0000-000000000000'::uuid],
  'active services are replaced and the inactive one is kept for when it comes back'
);
select throws_ok(
  $$select public.set_barber_services('a1000000-0000-0000-0000-000000000000',
      array['5b100000-0000-0000-0000-000000000000']::uuid[])$$,
  'P0002', null, 'a service of another barbershop cannot be given to a barber'
);
select throws_ok(
  $$select public.set_barber_services('b1000000-0000-0000-0000-000000000000', '{}'::uuid[])$$,
  'P0002', null, 'a barber of another barbershop cannot be changed'
);

-- A barber's own hours -----------------------------------------------------------------------

select lives_ok(
  $$select public.set_barber_schedule('a1000000-0000-0000-0000-000000000000', false,
      '[{"weekday": 1, "start": "09:00", "end": "12:00"},
        {"weekday": 1, "start": "14:00", "end": "18:00"}]')$$,
  'a barber gets their own hours'
);
select is(
  (select uses_barbershop_hours::text || ':' || count(s.*)
   from public.barbers b left join public.barber_schedules s on s.barber_id = b.id
   where b.id = 'a1000000-0000-0000-0000-000000000000' group by b.uses_barbershop_hours),
  'false:2', 'with a split shift'
);
select throws_ok(
  $$select public.set_barber_schedule('a1000000-0000-0000-0000-000000000000', false,
      '[{"weekday": 2, "start": "09:00", "end": "12:00"},
        {"weekday": 2, "start": "11:00", "end": "13:00"}]')$$,
  '23P01', null, 'shifts that overlap fail'
);
select is(
  (select count(*)::int from public.barber_schedules where barber_id = 'a1000000-0000-0000-0000-000000000000'),
  2, 'and the hours before stay as they were'
);
select lives_ok(
  $$select public.set_barber_schedule('a1000000-0000-0000-0000-000000000000', true, '[]')$$,
  'a barber goes back to the barbershop hours'
);
select is(
  (select count(*)::int from public.barber_schedules where barber_id = 'a1000000-0000-0000-0000-000000000000'),
  0, 'and their own rows are removed'
);
select throws_ok(
  $$select public.set_barber_schedule('b1000000-0000-0000-0000-000000000000', true, '[]')$$,
  'P0002', null, 'the hours of a barber of another barbershop cannot be changed'
);

-- Anonymous visitors run none of them ---------------------------------------------------------

reset role;
set local role anon;
select throws_ok(
  $$select public.set_barber_schedule('a1000000-0000-0000-0000-000000000000', true, '[]')$$,
  '42501', null, 'anon cannot change hours'
);

select * from finish();
rollback;
