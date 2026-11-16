-- Task 7.7, migrations add_walk_in_source and add_walk_in_appointments: the
-- walk-in appointment ("Cita al momento", decision D5).
--
-- - create_my_walk_in: only the professional of the session, for themself;
--   not without the terms, not inactive, not deleted, not in a paused
--   establishment; only active services they do.
-- - The time is the database's (now() rounded down to 5 minutes); length
--   and price come from the services; origin walk_in; confirmed, and it can
--   be marked attended at once.
-- - A clash is refused with walk_in_clash and a detail that says with what
--   (an appointment, an own block, a closure of the establishment, the end
--   of the hours, a closed day) and how many minutes are free. An exact fit
--   is accepted.
-- - No email is queued (neither the customer's nor the professional's).
-- - create_walk_in_appointment: the owner, only for professionals of THEIR
--   establishment. Another owner, a professional, the super admin and anon
--   cannot.
-- - The customer is optional: without a name, a walk_in row that the list of
--   customers leaves out, and that no session can create or fake.
-- - It takes the lock of the public booking for that day.
-- - The server path (service_role) and the session path still book and
--   create customers as before (the lesson of refuse_deleted_barber, 7.6c).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(74);

-- Structure and privileges -------------------------------------------------------------------

select has_column('public', 'customers', 'walk_in', 'customers.walk_in exists');
select ok(
  'walk_in' = any (enum_range(null::public.appointment_source)::text[]),
  'appointment_source has walk_in'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.create_my_walk_in(uuid[], text)'::regprocedure,
     'public.create_walk_in_appointment(uuid, uuid, uuid[], text)'::regprocedure,
     'public.my_services()'::regprocedure
   )),
  'the three public functions are security definer with an empty search_path'
);
select ok(
  (select bool_and(not prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'private.create_walk_in_of(uuid, uuid, uuid[], text)'::regprocedure,
     'private.walk_in_day_open(uuid, date)'::regprocedure,
     'private.guard_walk_in_customer()'::regprocedure
   )),
  'the private helpers run as their caller, with an empty search_path'
);
select ok(
  (select bool_and(
     has_function_privilege('authenticated', f, 'EXECUTE')
     and not has_function_privilege('anon', f, 'EXECUTE'))
   from unnest(array[
     'public.create_my_walk_in(uuid[], text)',
     'public.create_walk_in_appointment(uuid, uuid, uuid[], text)',
     'public.my_services()'
   ]) f),
  'only authenticated calls the three public functions'
);
select ok(
  (select bool_and(
     not has_function_privilege('anon', f, 'EXECUTE')
     and not has_function_privilege('authenticated', f, 'EXECUTE'))
   from unnest(array[
     'private.create_walk_in_of(uuid, uuid, uuid[], text)',
     'private.walk_in_day_open(uuid, date)',
     'private.guard_walk_in_customer()'
   ]) f),
  'no session calls the private helpers'
);

-- Helpers --------------------------------------------------------------------------------------

create function pg_temp.hint_of(statement text)
returns text
language plpgsql
as $$
declare
  error_hint text;
begin
  execute statement;
  return 'no error';
exception when others then
  get stacked diagnostics error_hint = pg_exception_hint;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;

create function pg_temp.detail_of(statement text)
returns jsonb
language plpgsql
as $$
declare
  error_detail text;
begin
  execute statement;
  return '{"error": "none"}'::jsonb;
exception when others then
  get stacked diagnostics error_detail = pg_exception_detail;
  return error_detail::jsonb;
end;
$$;

create function pg_temp.as_user(user_id uuid)
returns void
language plpgsql
as $$
begin
  if user_id is null then
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end;
$$;

-- The start of a walk-in made now: the minute rounded down to 5. now() is
-- the start of this transaction, so it is the same in every call below.
create function pg_temp.s()
returns timestamptz
language sql
stable
as $$
  select date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00+00')
$$;

create function pg_temp.at(days integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'America/Bogota')::date + days) + hhmm::time) at time zone 'America/Bogota'
$$;

grant execute on function pg_temp.hint_of(text), pg_temp.detail_of(text), pg_temp.as_user(uuid),
  pg_temp.s(), pg_temp.at(integer, text)
  to anon, authenticated, service_role;

-- Fixtures ---------------------------------------------------------------------------------------
-- W (por_acuerdo: seven active professionals), X and P (paused), each with
-- its owner. W is open all day, every day.
-- In W: Uno (account, terms; Corte, Barba and the inactive Tinte), Dos
-- (account, terms, notices on; Corte and Cejas; an appointment at S+10),
-- Tres (account without terms), Cuatro (account, inactive), Cinco (account,
-- deleted below), Seis (own block at S+20), Siete (hours that end at the
-- next quarter hour), Nueve (works another weekday only).
-- In X: Ocho (account, terms; a closure of X at S+15). In P: Pausa.

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, selected_plan) values
  ('aaaaaaaa-0000-0000-0000-000000007101', 'Barbería W', 'barberia-w-71', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '10 days', 'por_acuerdo'),
  ('aaaaaaaa-0000-0000-0000-000000007102', 'Barbería X', 'barberia-x-71', '+573001112244',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '10 days', 'standard'),
  ('aaaaaaaa-0000-0000-0000-000000007103', 'Barbería P', 'barberia-p-71', '+573001112255',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '10 days', 'standard');
insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-000000007101', 'owner-w-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-000000007102', 'owner-x-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-000000007103', 'owner-p-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000071ad', 'admin-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000071b1', 'uno-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000071b2', 'dos-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000071b3', 'tres-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000071b4', 'cuatro-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000071b5', 'cinco-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000071b8', 'ocho-71@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000071b9', 'pausa-71@example.com', '$2a$10$x');
insert into public.profiles (id, full_name, is_super_admin, terms_accepted_at, terms_version) values
  ('00000000-0000-0000-0000-000000007101', 'Dueña W', false, null, null),
  ('00000000-0000-0000-0000-000000007102', 'Dueño X', false, null, null),
  ('00000000-0000-0000-0000-000000007103', 'Dueño P', false, null, null),
  ('00000000-0000-0000-0000-0000000071ad', 'Admin', true, null, null),
  ('00000000-0000-0000-0000-0000000071b1', 'Uno', false, now(), 'prueba-71'),
  ('00000000-0000-0000-0000-0000000071b2', 'Dos', false, now(), 'prueba-71'),
  ('00000000-0000-0000-0000-0000000071b3', 'Tres', false, null, null),
  ('00000000-0000-0000-0000-0000000071b4', 'Cuatro', false, now(), 'prueba-71'),
  ('00000000-0000-0000-0000-0000000071b5', 'Cinco', false, now(), 'prueba-71'),
  ('00000000-0000-0000-0000-0000000071b8', 'Ocho', false, now(), 'prueba-71'),
  ('00000000-0000-0000-0000-0000000071b9', 'Pausa', false, now(), 'prueba-71');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000007101', 'aaaaaaaa-0000-0000-0000-000000007101', 'owner'),
  ('00000000-0000-0000-0000-000000007102', 'aaaaaaaa-0000-0000-0000-000000007102', 'owner'),
  ('00000000-0000-0000-0000-000000007103', 'aaaaaaaa-0000-0000-0000-000000007103', 'owner');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select s, d, '00:00', '24:00'
from generate_series(0, 6) d,
     unnest(array['aaaaaaaa-0000-0000-0000-000000007101', 'aaaaaaaa-0000-0000-0000-000000007102',
                  'aaaaaaaa-0000-0000-0000-000000007103']::uuid[]) s;
-- Open on holidays too, today and tomorrow: the test must not depend on the
-- day it runs (the closed holiday is tested at the end).
insert into public.holiday_openings (barbershop_id, holiday_date)
select s, d
from generate_series(private.today_bogota(), private.today_bogota() + 1, interval '1 day') g (day)
cross join lateral (select g.day::date as d) x,
     unnest(array['aaaaaaaa-0000-0000-0000-000000007101', 'aaaaaaaa-0000-0000-0000-000000007102',
                  'aaaaaaaa-0000-0000-0000-000000007103']::uuid[]) s
where private.is_colombian_holiday(d);
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000007101', 'aaaaaaaa-0000-0000-0000-000000007101', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000007102', 'aaaaaaaa-0000-0000-0000-000000007101', 'Barba', 12000, 15, true),
  ('5e000000-0000-0000-0000-000000007103', 'aaaaaaaa-0000-0000-0000-000000007101', 'Cejas', 8000, 10, true),
  ('5e000000-0000-0000-0000-000000007104', 'aaaaaaaa-0000-0000-0000-000000007101', 'Tinte', 40000, 60, false),
  ('5e000000-0000-0000-0000-000000007121', 'aaaaaaaa-0000-0000-0000-000000007102', 'Corte X', 20000, 30, true),
  ('5e000000-0000-0000-0000-000000007131', 'aaaaaaaa-0000-0000-0000-000000007103', 'Corte P', 20000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, email, is_owner, email_notifications, uses_barbershop_hours, active, deactivated_at) values
  ('ba000000-0000-0000-0000-000000007111', 'aaaaaaaa-0000-0000-0000-000000007101', 'Uno', 'uno-71@example.com', false, false, true, true, null),
  ('ba000000-0000-0000-0000-000000007112', 'aaaaaaaa-0000-0000-0000-000000007101', 'Dos', 'dos-71@example.com', false, true, true, true, null),
  ('ba000000-0000-0000-0000-000000007113', 'aaaaaaaa-0000-0000-0000-000000007101', 'Tres', 'tres-71@example.com', false, false, true, true, null),
  ('ba000000-0000-0000-0000-000000007114', 'aaaaaaaa-0000-0000-0000-000000007101', 'Cuatro', 'cuatro-71@example.com', false, false, true, false, now()),
  ('ba000000-0000-0000-0000-000000007115', 'aaaaaaaa-0000-0000-0000-000000007101', 'Cinco', 'cinco-71@example.com', false, false, true, true, null),
  ('ba000000-0000-0000-0000-000000007116', 'aaaaaaaa-0000-0000-0000-000000007101', 'Seis', null, false, false, true, true, null),
  ('ba000000-0000-0000-0000-000000007117', 'aaaaaaaa-0000-0000-0000-000000007101', 'Siete', null, false, false, false, true, null),
  ('ba000000-0000-0000-0000-000000007119', 'aaaaaaaa-0000-0000-0000-000000007101', 'Nueve', null, false, false, false, true, null),
  ('ba000000-0000-0000-0000-000000007121', 'aaaaaaaa-0000-0000-0000-000000007102', 'Ocho', 'ocho-71@example.com', false, false, true, true, null),
  ('ba000000-0000-0000-0000-000000007131', 'aaaaaaaa-0000-0000-0000-000000007103', 'Pausa', 'pausa-71@example.com', false, false, true, true, null);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007111', '5e000000-0000-0000-0000-000000007101'),
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007111', '5e000000-0000-0000-0000-000000007102'),
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007111', '5e000000-0000-0000-0000-000000007104'),
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007112', '5e000000-0000-0000-0000-000000007101'),
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007112', '5e000000-0000-0000-0000-000000007103'),
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007113', '5e000000-0000-0000-0000-000000007101'),
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007114', '5e000000-0000-0000-0000-000000007101'),
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007116', '5e000000-0000-0000-0000-000000007101'),
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007117', '5e000000-0000-0000-0000-000000007101'),
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007119', '5e000000-0000-0000-0000-000000007101'),
  ('aaaaaaaa-0000-0000-0000-000000007102', 'ba000000-0000-0000-0000-000000007121', '5e000000-0000-0000-0000-000000007121'),
  ('aaaaaaaa-0000-0000-0000-000000007103', 'ba000000-0000-0000-0000-000000007131', '5e000000-0000-0000-0000-000000007131');

-- Siete works today from 0:00 to the quarter hour after the current one
-- (24:00 in the last quarter of the day); Nueve only tomorrow's weekday.
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007117',
  extract(dow from private.today_bogota())::integer, '00:00',
  case
    when ((date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00+00') + interval '15 minutes')
          at time zone 'America/Bogota')::date > private.today_bogota() then '24:00'::time
    else ((date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00+00') + interval '15 minutes')
          at time zone 'America/Bogota')::time
  end;
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
values ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007119',
  (extract(dow from private.today_bogota())::integer + 1) % 7, '08:00', '18:00');

update public.barbers set profile_id = ('00000000-0000-0000-0000-0000000071b' || substr(display_name_key, 1, 1))::uuid
from (values ('ba000000-0000-0000-0000-000000007111'::uuid, '1'), ('ba000000-0000-0000-0000-000000007112'::uuid, '2'),
             ('ba000000-0000-0000-0000-000000007113'::uuid, '3'), ('ba000000-0000-0000-0000-000000007114'::uuid, '4'),
             ('ba000000-0000-0000-0000-000000007115'::uuid, '5'), ('ba000000-0000-0000-0000-000000007121'::uuid, '8'),
             ('ba000000-0000-0000-0000-000000007131'::uuid, '9')) v (barber, display_name_key)
where id = v.barber;

insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-000000007101', 'aaaaaaaa-0000-0000-0000-000000007101', 'Camila Rojas', 'camila-71@example.com');

-- Dos: a confirmed appointment from S+10 to S+40 (its notice is queued, as
-- any booking to come). Seis: their own block from S+20. X: a closure from
-- S+15.
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source) values
  ('a0000000-0000-0000-0000-000000007101', 'aaaaaaaa-0000-0000-0000-000000007101', 'c0000000-0000-0000-0000-000000007101',
   'ba000000-0000-0000-0000-000000007112', pg_temp.s() + interval '10 minutes', pg_temp.s() + interval '40 minutes', 25000, 'manual');
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id, price_cop, duration_minutes)
values ('aaaaaaaa-0000-0000-0000-000000007101', 'a0000000-0000-0000-0000-000000007101', 1,
        '5e000000-0000-0000-0000-000000007101', 25000, 30);
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007116',
   pg_temp.s() + interval '20 minutes', pg_temp.s() + interval '80 minutes', 'Almuerzo'),
  ('aaaaaaaa-0000-0000-0000-000000007102', null,
   pg_temp.s() + interval '15 minutes', pg_temp.s() + interval '120 minutes', 'Cierre');
set constraints all immediate;

-- Cinco is deleted by the owner; P is paused.
select pg_temp.as_user('00000000-0000-0000-0000-000000007101');
select public.delete_barber('ba000000-0000-0000-0000-000000007115');
reset role;
update public.barbershops set subscription_status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000007103';
-- From here, as in the app: the lines are checked when the transaction
-- ends (check_appointment_lines); the end of this test checks them.
set constraints all deferred;

-- Who cannot -------------------------------------------------------------------------------------

select pg_temp.as_user(null);
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  '42501', 'anon cannot call create_my_walk_in'
);
select is(
  pg_temp.hint_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007111', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  '42501', 'anon cannot call create_walk_in_appointment'
);
select is(pg_temp.hint_of($$select * from public.my_services()$$), '42501', 'anon cannot call my_services');

select pg_temp.as_user('00000000-0000-0000-0000-0000000071b3');
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'not_professional', 'a professional without the terms cannot'
);
select is((select count(*)::integer from public.my_services()), 0, 'and reads no services');

select pg_temp.as_user('00000000-0000-0000-0000-0000000071b4');
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'barber_inactive', 'an inactive professional cannot'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000071b5');
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'not_professional', 'a deleted professional''s account reaches nothing'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000071b9');
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007131']::uuid[])$$),
  'read_only', 'nor a professional of a paused establishment'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000071ad');
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'not_professional', 'the super admin is no professional'
);
select is(
  pg_temp.hint_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007116', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'not_found', 'nor the owner of W'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000007101');
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'not_professional', 'the owner is not a professional of the session'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000071b1');
select is(
  pg_temp.hint_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007111', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'not_found', 'a professional does not use the owner''s function, not even for themself'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000007102');
select is(
  pg_temp.hint_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007116', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'not_found', 'the owner of X does not reach W'
);
select is(
  pg_temp.hint_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007102',
    'ba000000-0000-0000-0000-000000007116', array['5e000000-0000-0000-0000-000000007121']::uuid[])$$),
  'barber_not_found', 'nor a professional of W through X'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000007103');
select is(
  pg_temp.hint_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007103',
    'ba000000-0000-0000-0000-000000007131', array['5e000000-0000-0000-0000-000000007131']::uuid[])$$),
  'barbershop_read_only', 'the owner of a paused establishment cannot'
);
reset role;
select is(
  (select count(*)::integer from public.appointments where source = 'walk_in'),
  0, 'none of those created anything'
);

-- The professional, for themself --------------------------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-0000000071b1');
select is(
  array(select name from public.my_services()),
  array['Barba', 'Corte'],
  'my_services: the active services Uno does, never the inactive one'
);
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007103']::uuid[])$$),
  'barber_does_not_offer_service', 'only services they do'
);
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007104']::uuid[])$$),
  'service_inactive', 'only active services'
);
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007121']::uuid[])$$),
  'service_inactive', 'never a service of another establishment'
);
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array[]::uuid[])$$),
  'services_required', 'at least one service'
);
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101',
    '5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'services_repeated', 'no service twice'
);
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[], repeat('a', 101))$$),
  'customer_name_invalid', 'a name of 100 characters at most'
);
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[], 'mira www.ejemplo.com')$$),
  'customer_name_invalid', 'a name without links'
);

create temporary table made (what text primary key, id uuid) on commit drop;
grant all on made to authenticated, anon, service_role;
insert into made select 'uno', public.create_my_walk_in(
  array['5e000000-0000-0000-0000-000000007101', '5e000000-0000-0000-0000-000000007102']::uuid[], '   ');
select ok(
  exists (
    select 1 from pg_locks l
    where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.granted
      and ((l.classid::bigint << 32) | l.objid::bigint) = hashtextextended(
        'book_appointment:aaaaaaaa-0000-0000-0000-000000007101:' || (pg_temp.s() at time zone 'America/Bogota')::date::text, 0)
  ),
  'it takes the lock of the public booking for that establishment and day'
);
reset role;
select is(
  (select row(a.barber_id, a.starts_at, a.ends_at, a.price_cop, a.source::text, a.status::text)::text
   from public.appointments a where a.id = (select id from made where what = 'uno')),
  row('ba000000-0000-0000-0000-000000007111'::uuid, pg_temp.s(), pg_temp.s() + interval '45 minutes',
      37000, 'walk_in', 'confirmed')::text,
  'Uno''s walk-in: now rounded down to 5 minutes, the length and the price of both services, walk_in, confirmed'
);
select ok(pg_temp.s() <= now() and now() < pg_temp.s() + interval '5 minutes', 'the start is never in the future');
select is(
  (select count(*)::integer from public.appointment_services where appointment_id = (select id from made where what = 'uno')),
  2, 'with its two lines'
);
select is(
  (select row(c.full_name, c.walk_in, c.email, c.phone)::text
   from public.appointments a join public.customers c on c.id = a.customer_id
   where a.id = (select id from made where what = 'uno')),
  row('Cliente al momento', true, null::text, null::text)::text,
  'a blank name is no name: a walk-in customer, without data'
);

select pg_temp.as_user('00000000-0000-0000-0000-0000000071b1');
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007102']::uuid[])$$),
  'walk_in_clash', 'a second walk-in now clashes with the first'
);
select is(
  pg_temp.detail_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007102']::uuid[])$$)
    - 'at' - 'until' - 'startsAt',
  '{"kind": "appointment", "freeMinutes": 0, "neededMinutes": 15}'::jsonb,
  'with an appointment, and no minute free'
);
select lives_ok(
  $$select public.mark_my_appointment((select id from made where what = 'uno'), 'attended')$$,
  'the professional marks it attended at once: it already started'
);
reset role;
select is(
  (select status::text from public.appointments where id = (select id from made where what = 'uno')),
  'attended', 'and it is attended'
);

-- The clash, with what and how much is free -------------------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-0000000071b2');
select is(
  pg_temp.detail_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[], 'Pedro')$$),
  jsonb_build_object('kind', 'appointment', 'at', pg_temp.s() + interval '10 minutes',
    'until', pg_temp.s() + interval '40 minutes', 'freeMinutes', 10, 'neededMinutes', 30,
    'startsAt', pg_temp.s()),
  'Dos: 30 minutes do not fit before the appointment at S+10, and 10 are free'
);
insert into made select 'dos', public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007103']::uuid[], ' Pedro Pérez ');
reset role;
select is(
  (select row(a.ends_at, c.full_name, c.walk_in)::text
   from public.appointments a join public.customers c on c.id = a.customer_id
   where a.id = (select id from made where what = 'dos')),
  row(pg_temp.s() + interval '10 minutes', 'Pedro Pérez', false)::text,
  'an exact fit is accepted, and the name makes a customer like any other'
);

select pg_temp.as_user('00000000-0000-0000-0000-000000007101');
select is(
  pg_temp.detail_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007116', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$)
    - 'until' - 'startsAt',
  jsonb_build_object('kind', 'block', 'at', pg_temp.s() + interval '20 minutes', 'freeMinutes', 20, 'neededMinutes', 30),
  'the owner, for Seis: their own block at S+20 leaves 20 minutes'
);
select is(
  pg_temp.detail_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007117', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$)
    - 'startsAt',
  jsonb_build_object('kind', 'closing',
    'at', date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00+00') + interval '15 minutes',
    'until', null,
    'freeMinutes', extract(epoch from date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00+00')
      + interval '15 minutes' - pg_temp.s())::integer / 60,
    'neededMinutes', 30),
  'for Siete: their hours end at the next quarter hour'
);
select is(
  pg_temp.detail_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007119', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$)
    - 'startsAt',
  '{"kind": "closed", "at": null, "until": null, "freeMinutes": 0, "neededMinutes": 30}'::jsonb,
  'for Nueve: they do not work today'
);
select is(
  pg_temp.hint_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007114', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'barber_inactive', 'not for an inactive professional'
);
select is(
  pg_temp.hint_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007115', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'barber_inactive', 'nor for a deleted one'
);
select is(
  pg_temp.hint_of($$select public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007121', array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'barber_not_found', 'nor for a professional of another establishment'
);
insert into made select 'tres', public.create_walk_in_appointment('aaaaaaaa-0000-0000-0000-000000007101',
  'ba000000-0000-0000-0000-000000007113', array['5e000000-0000-0000-0000-000000007101']::uuid[]);
reset role;
select is(
  (select row(a.barber_id, a.starts_at, a.source::text)::text from public.appointments a
   where a.id = (select id from made where what = 'tres')),
  row('ba000000-0000-0000-0000-000000007113'::uuid, pg_temp.s(), 'walk_in')::text,
  'the owner creates one for a professional of their establishment (with or without an account)'
);

select pg_temp.as_user('00000000-0000-0000-0000-0000000071b8');
select is(
  pg_temp.detail_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007121']::uuid[])$$)
    - 'until' - 'startsAt',
  jsonb_build_object('kind', 'closure', 'at', pg_temp.s() + interval '15 minutes', 'freeMinutes', 15, 'neededMinutes', 30),
  'Ocho: a closure of the establishment at S+15 leaves 15 minutes'
);
select is(
  pg_temp.hint_of($$select public.create_my_walk_in(array['5e000000-0000-0000-0000-000000007101']::uuid[])$$),
  'service_inactive', 'and Ocho never reaches the services of W'
);
reset role;

-- No email ---------------------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.notifications
   where appointment_id in (select id from made)),
  0, 'no email is queued for a walk-in: neither the customer''s nor the professional''s'
);
select ok(
  exists (select 1 from public.notifications where appointment_id = 'a0000000-0000-0000-0000-000000007101'),
  'while the booking to come of Dos, whose notices are on, did queue its notice'
);

-- The customers ---------------------------------------------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-000000007101');
select is(
  array(select full_name from public.list_customers('aaaaaaaa-0000-0000-0000-000000007101')),
  array['Camila Rojas', 'Pedro Pérez'],
  'the list of customers leaves out the walk-ins without a name'
);
select is(
  pg_temp.hint_of($$insert into public.customers (barbershop_id, full_name, walk_in)
    values ('aaaaaaaa-0000-0000-0000-000000007101', 'Falso', true)$$),
  'walk_in_reserved', 'a session never creates a walk-in customer'
);
select is(
  pg_temp.hint_of($$update public.customers set walk_in = true where id = 'c0000000-0000-0000-0000-000000007101'$$),
  'walk_in_reserved', 'nor turns a customer into one'
);
select lives_ok(
  $$update public.customers set notes = 'Viene los viernes'
    where id = (select customer_id from public.appointments where id = (select id from made where what = 'tres'))$$,
  'the owner can write a note on a walk-in customer'
);
select is(
  (select walk_in from public.customers
   where id = (select customer_id from public.appointments where id = (select id from made where what = 'tres'))),
  true, 'which stays a walk-in'
);
select lives_ok(
  $$update public.customers set full_name = 'Andrés Gómez'
    where id = (select customer_id from public.appointments where id = (select id from made where what = 'tres'))$$,
  'and can give it a name'
);
select is(
  array(select full_name from public.list_customers('aaaaaaaa-0000-0000-0000-000000007101')),
  array['Andrés Gómez', 'Camila Rojas', 'Pedro Pérez'],
  'which makes it a customer of the list'
);
select is(
  (select count(*)::integer from public.list_customers('aaaaaaaa-0000-0000-0000-000000007102')),
  0, 'the owner of W lists no customer of X'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000007102');
select is(
  (select count(*)::integer from public.customers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000007101'),
  0, 'and the owner of X reads no customer of W, walk-ins included'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000071b1');
select is(
  (select count(*)::integer from public.customers) + (select count(*)::integer from public.appointments),
  0, 'the professional reads no table: their walk-ins included'
);
select pg_temp.as_user(null);
select throws_ok(
  $$insert into public.customers (barbershop_id, full_name)
    values ('aaaaaaaa-0000-0000-0000-000000007101', 'Anónimo')$$,
  '42501', null, 'anon writes no customer, as before'
);
reset role;
select is(
  (select count(*)::integer from public.customers where walk_in),
  1, 'only the walk-in without a name left a walk-in customer'
);

-- The server and the session paths still work (7.6c lesson) ----------------------------------------

set local role service_role;
select lives_ok(
  $$insert into public.customers (barbershop_id, full_name) values ('aaaaaaaa-0000-0000-0000-000000007101', 'Del servidor')$$,
  'the server (service_role) creates a customer'
);
select lives_ok(
  $$select public.book_appointment_from_app('aaaaaaaa-0000-0000-0000-000000007101', pg_temp.at(1, '10:00'),
    array['5e000000-0000-0000-0000-000000007101']::uuid[], 'Laura Web', 'laura-71@example.com', repeat('b', 64),
    'ba000000-0000-0000-0000-000000007111')$$,
  'and books from the app for Uno, as before'
);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000007101');
select lives_ok(
  $$select public.create_manual_appointment('aaaaaaaa-0000-0000-0000-000000007101', 'ba000000-0000-0000-0000-000000007116',
    pg_temp.at(1, '11:00'), array['5e000000-0000-0000-0000-000000007101']::uuid[], null, 'Manual Nueva')$$,
  'the owner''s session creates a manual appointment with a new customer, as before'
);
select lives_ok(
  $$insert into public.customers (barbershop_id, full_name) values ('aaaaaaaa-0000-0000-0000-000000007101', 'A mano')$$,
  'and a customer straight into the table, as before'
);
reset role;
select is(
  (select array_agg(source::text order by source::text) from public.appointments
   where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000007101' and starts_at >= pg_temp.at(1, '00:00')),
  array['manual', 'web'],
  'both appointments of tomorrow are there, with their usual origin'
);

-- A session still cannot fake the origin --------------------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-000000007101');
select throws_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000007101', 'c0000000-0000-0000-0000-000000007101',
    'ba000000-0000-0000-0000-000000007116', pg_temp.at(2, '11:00'), array['5e000000-0000-0000-0000-000000007101']::uuid[], 'walk_in')$$,
  '42501', null, 'the owner cannot create a walk_in by the generic path'
);
select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000007101', 'c0000000-0000-0000-0000-000000007101',
      'ba000000-0000-0000-0000-000000007116', pg_temp.at(2, '11:00'), pg_temp.at(2, '11:30'), 25000, 'walk_in')$$,
  '42501', null, 'nor straight into the table'
);
reset role;

select lives_ok(
  'set constraints all immediate',
  'every appointment created here passes the checks of its lines, as at the commit'
);

-- A holiday the establishment keeps closed has no open time -------------------------------------

select is(
  private.walk_in_day_open('aaaaaaaa-0000-0000-0000-000000007102', date '2026-12-25'),
  false, 'Christmas, not opened by X, is closed for a walk-in'
);
insert into public.holiday_openings (barbershop_id, holiday_date)
values ('aaaaaaaa-0000-0000-0000-000000007102', date '2026-12-25');
select is(
  private.walk_in_day_open('aaaaaaaa-0000-0000-0000-000000007102', date '2026-12-25'),
  true, 'and open once X opens it'
);

select * from finish();
rollback;
