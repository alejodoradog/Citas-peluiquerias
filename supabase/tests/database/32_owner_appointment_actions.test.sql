-- Task 4.2, migration add_owner_appointment_actions: what the owner does with
-- an appointment from the panel (D-34 to D-39).
--
-- - Manual appointment: a chosen customer, or a new one with only the name
--   (an email that already exists reuses that customer, never changed). An
--   active barber who offers every service, inside their hours, with no
--   block or appointment in between; from the current quarter hour (no
--   minimum notice) to 30 days ahead; closed holidays are closed.
-- - Reschedule: a confirmed appointment, same duration, to any barber who
--   offers its services, with the same rules; it never clashes with itself.
-- - Change services: also checks the barber and, before the appointment
--   starts, its hours and blocks.
-- - Status: attended or no_show once it started (and corrected between
--   them); cancelled_by_barbershop while confirmed, at any time.
-- - Blocks: one barber or the whole barbershop, one Bogotá day in steps of
--   15 minutes, from now to 30 days ahead, fixed reasons, and no appointment
--   in between. Removing one that has not ended.
-- - Only for the members of the barbershop; anon executes nothing. The
--   history records staff and the owner.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(87);

-- Structure and privileges -------------------------------------------------------------------

select has_function(
  'public', 'create_manual_appointment',
  array['uuid', 'uuid', 'timestamp with time zone', 'uuid[]', 'uuid', 'text', 'text', 'text'],
  'create_manual_appointment exists'
);
select has_function(
  'public', 'reschedule_appointment', array['uuid', 'uuid', 'timestamp with time zone'],
  'reschedule_appointment exists'
);
select has_function(
  'public', 'change_appointment_services_checked', array['uuid', 'uuid[]'],
  'change_appointment_services_checked exists'
);
select has_function(
  'public', 'set_appointment_status', array['uuid', 'appointment_status'],
  'set_appointment_status exists'
);
select has_function(
  'public', 'create_time_block',
  array['uuid', 'uuid', 'timestamp with time zone', 'timestamp with time zone', 'text'],
  'create_time_block exists'
);
select has_function('public', 'delete_time_block', array['uuid'], 'delete_time_block exists');

select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.create_manual_appointment(uuid, uuid, timestamptz, uuid[], uuid, text, text, text)'::regprocedure,
     'public.reschedule_appointment(uuid, uuid, timestamptz)'::regprocedure,
     'public.change_appointment_services_checked(uuid, uuid[])'::regprocedure,
     'public.set_appointment_status(uuid, public.appointment_status)'::regprocedure,
     'public.create_time_block(uuid, uuid, timestamptz, timestamptz, text)'::regprocedure,
     'public.delete_time_block(uuid)'::regprocedure
   )),
  'the six functions are security definer with an empty search_path'
);
select ok(
  (select bool_and(
     has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
   from unnest(array[
     'public.create_manual_appointment(uuid, uuid, timestamptz, uuid[], uuid, text, text, text)',
     'public.reschedule_appointment(uuid, uuid, timestamptz)',
     'public.change_appointment_services_checked(uuid, uuid[])',
     'public.set_appointment_status(uuid, public.appointment_status)',
     'public.create_time_block(uuid, uuid, timestamptz, timestamptz, text)',
     'public.delete_time_block(uuid)'
   ]) f),
  'authenticated calls the six functions and anon none'
);
select ok(
  (select bool_and(not has_function_privilege('authenticated', f, 'EXECUTE'))
   from unnest(array[
     'private.owner_reaches(uuid)',
     'private.owner_time_problem(uuid, timestamptz, integer)',
     'private.owner_slot_problem(uuid, uuid, timestamptz, timestamptz, uuid)',
     'private.lock_booking_day(uuid, date)'
   ]) f),
  'nobody calls the helpers directly'
);

-- Fixtures, inserted as the table owner -----------------------------------------------------------
-- Barbershop A (owner a) and B (owner b), open 06:00 to 22:00 every day.
-- In A: Uno (offers Corte, Barba, Largo and Largo dos), Dos (Corte only) and
-- Inactivo. In B: Tres.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com');
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Barbería A', 'citas-a', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Barbería B', 'citas-b', '+573001112244',
   private.today_bogota() + 10, private.today_bogota() + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233'),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000002', 'owner');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select s, d, '06:00', '22:00'
from generate_series(0, 6) d,
     unnest(array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[]) s;
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Barba', 15000, 15, true),
  ('5e000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Largo', 1000, 240, true),
  ('5e000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Largo dos', 1000, 240, true),
  ('5e000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'Viejo', 9000, 30, false),
  ('5e000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000002', 'Corte B', 20000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Uno', encode(sha256(convert_to('Uno', 'UTF8')), 'hex'), 1, true),
  ('ba000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dos', encode(sha256(convert_to('Dos', 'UTF8')), 'hex'), 2, true),
  ('ba000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Inactivo', encode(sha256(convert_to('Inactivo', 'UTF8')), 'hex'), 3, true),
  ('ba000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Tres', encode(sha256(convert_to('Tres', 'UTF8')), 'hex'), 1, true);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000004'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'ba000000-0000-0000-0000-000000000004', '5e000000-0000-0000-0000-000000000006');
update public.barbers set active = false where id = 'ba000000-0000-0000-0000-000000000003';

insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Camila Rojas', 'camila@example.com'),
  ('c0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Cliente B', 'b@example.com');

-- The working days ahead (no Colombian holiday), so no test lands on a
-- closed day: wd 1 is the first one after today.
create temp table wd as
select (row_number() over (order by d))::integer as n, d::date as d
from generate_series(
  (private.today_bogota() + 1)::timestamp, (private.today_bogota() + 20)::timestamp, interval '1 day'
) d
where not private.is_colombian_holiday(d::date);
grant select on wd to anon, authenticated;

-- The first holiday in the next 30 days, if any (the fixtures open none).
create temp table hol as
select min(gs::date) as d
from generate_series(
  (private.today_bogota() + 1)::timestamp, (private.today_bogota() + 30)::timestamp, interval '1 day'
) gs
where private.is_colombian_holiday(gs::date);
grant select on hol to anon, authenticated;

-- hh:mm Bogotá on working day n.
create function pg_temp.at(n integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select ((select wd.d from pg_temp.wd where wd.n = $1) + hhmm::time) at time zone 'America/Bogota'
$$;

-- hh:mm Bogotá, `days` days from today in Bogotá.
create function pg_temp.day_at(days integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'America/Bogota')::date + days) + hhmm::time) at time zone 'America/Bogota'
$$;

-- The hint of the error a statement raises, or 'no error'.
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

grant execute on function pg_temp.at(integer, text), pg_temp.day_at(integer, text), pg_temp.hint_of(text)
  to anon, authenticated;

-- a1: Uno, wd1 10:00-10:30, Corte. a2: Uno, started 20 minutes ago, Corte.
-- a3: Uno, wd1 12:00, cancelled. a4: Tres in B, wd1 10:00. a5: Dos, wd2
-- 11:00-11:30.
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, status) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '10:00'), pg_temp.at(1, '10:30'), 25000, 'web', 'confirmed'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', now() - interval '20 minutes', now() + interval '10 minutes', 25000, 'manual', 'confirmed'),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '12:00'), pg_temp.at(1, '12:30'), 25000, 'web', 'cancelled_by_customer'),
  ('a0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003',
   'ba000000-0000-0000-0000-000000000004', pg_temp.at(1, '10:00'), pg_temp.at(1, '10:30'), 20000, 'web', 'confirmed'),
  ('a0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000002', pg_temp.at(2, '11:00'), pg_temp.at(2, '11:30'), 25000, 'manual', 'confirmed');
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id, price_cop, duration_minutes) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1, '5e000000-0000-0000-0000-000000000001', 25000, 30),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 1, '5e000000-0000-0000-0000-000000000001', 25000, 30),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 1, '5e000000-0000-0000-0000-000000000001', 25000, 30),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 1, '5e000000-0000-0000-0000-000000000006', 20000, 30),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 1, '5e000000-0000-0000-0000-000000000001', 25000, 30);

-- k1: Uno, wd1 14:00-15:00. k2: Dos, ended two hours ago. k3: Tres in B.
insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('b0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
   pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00'), 'Almuerzo'),
  ('b0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002',
   now() - interval '3 hours', now() - interval '2 hours', 'Permiso'),
  ('b0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'ba000000-0000-0000-0000-000000000004',
   pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00'), null);

-- As owner a ---------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- create_manual_appointment

select lives_ok(
  $$ select public.create_manual_appointment(
       'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002', pg_temp.at(1, '09:00'),
       array['5e000000-0000-0000-0000-000000000001']::uuid[], null, '  Juan Llegó  ', null, null) $$,
  'a walk-in with only a name gets an appointment'
);
select is(
  (select row(a.source::text, a.status::text, a.ends_at - a.starts_at, a.price_cop)::text
   from public.appointments a
   where a.barber_id = 'ba000000-0000-0000-0000-000000000002' and a.starts_at = pg_temp.at(1, '09:00')),
  row('manual', 'confirmed', interval '30 minutes', 25000)::text,
  'it is manual and confirmed, with the duration and price of its services'
);
select is(
  (select row(c.email, c.phone)::text from public.customers c where c.full_name = 'Juan Llegó'),
  row(null::text, null::text)::text,
  'the new customer has only the name, trimmed'
);
select lives_ok(
  $$ select public.create_manual_appointment(
       'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '16:00'),
       array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[],
       null, 'Otro Nombre', ' CAMILA@example.com ', null) $$,
  'an email that exists books for that customer'
);
select is(
  (select row(a.customer_id, a.ends_at - a.starts_at, a.price_cop)::text
   from public.appointments a
   where a.barber_id = 'ba000000-0000-0000-0000-000000000001' and a.starts_at = pg_temp.at(1, '16:00')),
  row('c0000000-0000-0000-0000-000000000001'::uuid, interval '45 minutes', 40000)::text,
  'it uses that customer, with the sum of two services'
);
select is(
  (select full_name from public.customers where id = 'c0000000-0000-0000-0000-000000000001'),
  'Camila Rojas',
  'and never changes the customer'
);
select lives_ok(
  $$ select public.create_manual_appointment(
       'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '17:00'),
       array['5e000000-0000-0000-0000-000000000001']::uuid[], 'c0000000-0000-0000-0000-000000000001', null, null, null) $$,
  'a chosen customer gets an appointment'
);
select lives_ok(
  $$ select public.create_manual_appointment(
       'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '13:30'),
       array['5e000000-0000-0000-0000-000000000001']::uuid[], 'c0000000-0000-0000-0000-000000000001', null, null, null) $$,
  'right before a block'
);

select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], 'c0000000-0000-0000-0000-000000000003', null, null, null) $$),
  'customer_not_found',
  'a customer of another barbershop is not found'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, '   ', null, null) $$),
  'customer_name_invalid',
  'a new customer needs a name'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', 'no-es-correo', null) $$),
  'customer_email_invalid',
  'an email, when given, must be valid'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, '123') $$),
  'customer_phone_invalid',
  'a phone, when given, is a Colombian mobile'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '10:00'),
    array[]::uuid[], null, 'Ana', null, null) $$),
  'services_required',
  'at least one service'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'services_repeated',
  'no repeated service'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000005']::uuid[], null, 'Ana', null, null) $$),
  'service_inactive',
  'no inactive service'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '07:00'),
    array['5e000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000004',
          '5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'too_long',
  'no more than 480 minutes'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000004', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'barber_not_found',
  'a barber of another barbershop is not found'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000003', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'barber_inactive',
  'an inactive barber takes no new appointments'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000002']::uuid[], null, 'Ana', null, null) $$),
  'barber_does_not_offer_service',
  'the barber offers every service'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '10:05'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'slot_invalid',
  'starts on a quarter hour'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.day_at(-1, '10:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'too_early',
  'never in the past'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.day_at(31, '10:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'outside_booking_window',
  'up to 30 days ahead'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '05:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'outside_hours',
  'inside the hours of the barber'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '14:15'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'blocked',
  'never over a block'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '10:15'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  'slot_taken',
  'never over another appointment'
);
select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000002', 'ba000000-0000-0000-0000-000000000004', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000006']::uuid[], null, 'Ana', null, null) $$),
  'not_found',
  'never in another barbershop'
);
select case
  when (select hol.d from pg_temp.hol) is null then ok(true, 'no closed holiday in the next 30 days')
  else is(
    pg_temp.hint_of(format(
      $$ select public.create_manual_appointment(
           'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', %L,
           array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$,
      ((select hol.d from pg_temp.hol) + time '10:00') at time zone 'America/Bogota')),
    'closed',
    'a holiday the barbershop does not open is closed')
end;

-- reschedule_appointment

select lives_ok(
  $$ select public.reschedule_appointment(
       'a0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002', pg_temp.at(2, '09:00')) $$,
  'an appointment moves to another barber and day'
);
select is(
  (select row(a.barber_id, a.starts_at, a.ends_at)::text from public.appointments a
   where a.id = 'a0000000-0000-0000-0000-000000000001'),
  row('ba000000-0000-0000-0000-000000000002'::uuid, pg_temp.at(2, '09:00'), pg_temp.at(2, '09:30'))::text,
  'and keeps its duration'
);
select is(
  (select row(e.actor::text, e.actor_user_id, e.new_barber_id)::text
   from public.appointment_events e
   where e.appointment_id = 'a0000000-0000-0000-0000-000000000001' and e.type = 'rescheduled'),
  row('staff', '00000000-0000-0000-0000-00000000000a'::uuid, 'ba000000-0000-0000-0000-000000000002'::uuid)::text,
  'the history records the owner and the new barber'
);
select lives_ok(
  $$ select public.reschedule_appointment(
       'a0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002', pg_temp.at(2, '09:15')) $$,
  'it never clashes with itself'
);
select is(
  pg_temp.hint_of($$ select public.reschedule_appointment(
    'a0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002', pg_temp.at(2, '11:15')) $$),
  'slot_taken',
  'but it does with another appointment'
);
select is(
  pg_temp.hint_of($$ select public.reschedule_appointment(
    'a0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '14:00')) $$),
  'blocked',
  'and with a block'
);
select is(
  pg_temp.hint_of($$ select public.reschedule_appointment(
    (select a.id from public.appointments a
     where a.barber_id = 'ba000000-0000-0000-0000-000000000001' and a.starts_at = pg_temp.at(1, '16:00')),
    'ba000000-0000-0000-0000-000000000002', pg_temp.at(2, '13:00')) $$),
  'barber_does_not_offer_service',
  'the new barber offers every service of the appointment'
);
select is(
  pg_temp.hint_of($$ select public.reschedule_appointment(
    'a0000000-0000-0000-0000-000000000003', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '13:00')) $$),
  'not_confirmed',
  'a cancelled appointment does not move'
);
select is(
  pg_temp.hint_of($$ select public.reschedule_appointment(
    'a0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000003', pg_temp.at(2, '13:00')) $$),
  'barber_inactive',
  'nor to an inactive barber'
);
select is(
  pg_temp.hint_of($$ select public.reschedule_appointment(
    'a0000000-0000-0000-0000-000000000004', 'ba000000-0000-0000-0000-000000000004', pg_temp.at(2, '13:00')) $$),
  'not_found',
  'an appointment of another barbershop is not found'
);

-- change_appointment_services_checked

select is(
  pg_temp.hint_of($$ select public.change_appointment_services_checked(
    'a0000000-0000-0000-0000-000000000001',
    array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[]) $$),
  'barber_does_not_offer_service',
  'new services need a barber who offers them'
);
select lives_ok(
  $$ select public.change_appointment_services_checked(
       (select a.id from public.appointments a
        where a.barber_id = 'ba000000-0000-0000-0000-000000000001' and a.starts_at = pg_temp.at(1, '17:00')),
       array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[]) $$,
  'adding the beard to an appointment'
);
select is(
  (select row(a.ends_at - a.starts_at, a.price_cop)::text from public.appointments a
   where a.barber_id = 'ba000000-0000-0000-0000-000000000001' and a.starts_at = pg_temp.at(1, '17:00')),
  row(interval '45 minutes', 40000)::text,
  'recalculates its duration and price'
);
select is(
  pg_temp.hint_of($$ select public.change_appointment_services_checked(
    (select a.id from public.appointments a
     where a.barber_id = 'ba000000-0000-0000-0000-000000000001' and a.starts_at = pg_temp.at(1, '13:30')),
    array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[]) $$),
  'blocked',
  'an appointment that has not started does not grow over a block'
);
select lives_ok(
  $$ select public.change_appointment_services_checked(
       'a0000000-0000-0000-0000-000000000002',
       array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[]) $$,
  'one in the chair grows without the hours check'
);
select is(
  pg_temp.hint_of($$ select public.change_appointment_services_checked(
    'a0000000-0000-0000-0000-000000000002',
    array['5e000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000004',
          '5e000000-0000-0000-0000-000000000001']::uuid[]) $$),
  'too_long',
  'but never past 480 minutes'
);
select is(
  pg_temp.hint_of($$ select public.change_appointment_services_checked(
    'a0000000-0000-0000-0000-000000000003', array['5e000000-0000-0000-0000-000000000001']::uuid[]) $$),
  'appointment_closed',
  'a cancelled appointment keeps its services'
);
select is(
  pg_temp.hint_of($$ select public.change_appointment_services_checked(
    'a0000000-0000-0000-0000-000000000004', array['5e000000-0000-0000-0000-000000000006']::uuid[]) $$),
  'not_found',
  'an appointment of another barbershop is not found'
);

-- set_appointment_status

select is(
  pg_temp.hint_of($$ select public.set_appointment_status('a0000000-0000-0000-0000-000000000001', 'attended') $$),
  'not_started',
  'an appointment that has not started is not attended'
);
select lives_ok(
  $$ select public.set_appointment_status('a0000000-0000-0000-0000-000000000002', 'no_show') $$,
  'one that started is marked as a no-show'
);
select lives_ok(
  $$ select public.set_appointment_status('a0000000-0000-0000-0000-000000000002', 'attended') $$,
  'and corrected to attended'
);
select is(
  (select status::text from public.appointments where id = 'a0000000-0000-0000-0000-000000000002'),
  'attended',
  'the correction stays'
);
select is(
  pg_temp.hint_of($$ select public.set_appointment_status('a0000000-0000-0000-0000-000000000002', 'cancelled_by_barbershop') $$),
  'not_confirmed',
  'an attended appointment is not cancelled'
);
select lives_ok(
  $$ select public.set_appointment_status('a0000000-0000-0000-0000-000000000001', 'cancelled_by_barbershop') $$,
  'the barbershop cancels a confirmed appointment'
);
select is(
  (select status::text from public.appointments where id = 'a0000000-0000-0000-0000-000000000001'),
  'cancelled_by_barbershop',
  'and it is cancelled by the barbershop'
);
select is(
  pg_temp.hint_of($$ select public.set_appointment_status('a0000000-0000-0000-0000-000000000003', 'attended') $$),
  'not_confirmed',
  'a cancelled appointment is not marked'
);
select is(
  pg_temp.hint_of($$ select public.set_appointment_status('a0000000-0000-0000-0000-000000000003', 'confirmed') $$),
  'status_invalid',
  'the panel does not bring a cancelled appointment back'
);
select is(
  pg_temp.hint_of($$ select public.set_appointment_status('a0000000-0000-0000-0000-000000000004', 'cancelled_by_barbershop') $$),
  'not_found',
  'an appointment of another barbershop is not found'
);
select ok(
  (select count(*) >= 2 from public.appointment_events e
   where e.appointment_id = 'a0000000-0000-0000-0000-000000000002'
     and e.actor = 'staff' and e.actor_user_id = '00000000-0000-0000-0000-00000000000a'),
  'the marks of the panel are recorded with the owner'
);

-- create_time_block

select lives_ok(
  $$ select public.create_time_block(
       'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
       pg_temp.at(2, '13:00'), pg_temp.at(2, '14:00'), 'Almuerzo') $$,
  'a lunch block for a barber'
);
select is(
  (select reason from public.time_blocks
   where barber_id = 'ba000000-0000-0000-0000-000000000001' and starts_at = pg_temp.at(2, '13:00')),
  'Almuerzo',
  'keeps its reason'
);
select lives_ok(
  $$ select public.create_time_block(
       'aaaaaaaa-0000-0000-0000-000000000001', null, pg_temp.at(2, '06:00'), pg_temp.at(2, '07:00'), null) $$,
  'a block of the whole barbershop, without reason'
);
select is(
  (select count(*)::integer from public.time_blocks
   where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001' and barber_id is null
     and starts_at = pg_temp.at(2, '06:00') and reason is null),
  1,
  'it has no barber'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002',
    pg_temp.at(2, '10:45'), pg_temp.at(2, '11:15'), null) $$),
  'overlaps_appointment',
  'a block never covers an appointment of the barber'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', null, pg_temp.at(2, '11:00'), pg_temp.at(2, '12:00'), null) $$),
  'overlaps_appointment',
  'nor of anyone, for the whole barbershop'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
    pg_temp.at(1, '14:30'), pg_temp.at(1, '15:30'), null) $$),
  'overlaps_block',
  'nor another block'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
    pg_temp.at(3, '13:00'), pg_temp.at(3, '14:00'), 'Fiesta') $$),
  'range_invalid',
  'the reasons are fixed'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
    pg_temp.at(3, '13:10'), pg_temp.at(3, '14:00'), null) $$),
  'range_invalid',
  'in steps of 15 minutes'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
    pg_temp.at(3, '13:00'), pg_temp.at(3, '13:00') + interval '1 day', null) $$),
  'range_invalid',
  'within one day'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
    pg_temp.day_at(-1, '13:00'), pg_temp.day_at(-1, '14:00'), null) $$),
  'too_early',
  'never in the past'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
    pg_temp.day_at(31, '13:00'), pg_temp.day_at(31, '14:00'), null) $$),
  'range_invalid',
  'up to 30 days ahead'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000003',
    pg_temp.at(3, '13:00'), pg_temp.at(3, '14:00'), null) $$),
  'barber_inactive',
  'an inactive barber takes no new blocks'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000004',
    pg_temp.at(3, '13:00'), pg_temp.at(3, '14:00'), null) $$),
  'barber_not_found',
  'a barber of another barbershop is not found'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block(
    'aaaaaaaa-0000-0000-0000-000000000002', null, pg_temp.at(3, '13:00'), pg_temp.at(3, '14:00'), null) $$),
  'not_found',
  'never in another barbershop'
);

-- delete_time_block

select lives_ok(
  $$ select public.delete_time_block('b0000000-0000-0000-0000-000000000001') $$,
  'the owner removes a block'
);
select is(
  (select count(*)::integer from public.time_blocks where id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'and it is gone'
);
select is(
  pg_temp.hint_of($$ select public.delete_time_block('b0000000-0000-0000-0000-000000000002') $$),
  'block_ended',
  'a block that ended stays'
);
select is(
  pg_temp.hint_of($$ select public.delete_time_block('b0000000-0000-0000-0000-000000000003') $$),
  'not_found',
  'a block of another barbershop is not found'
);

-- As owner b, and as anon ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  pg_temp.hint_of($$ select public.set_appointment_status('a0000000-0000-0000-0000-000000000005', 'cancelled_by_barbershop') $$),
  'not_found',
  'owner b does not reach an appointment of A'
);
select is(
  pg_temp.hint_of($$ select public.delete_time_block('b0000000-0000-0000-0000-000000000002') $$),
  'not_found',
  'nor a block of A'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  pg_temp.hint_of($$ select public.create_manual_appointment(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '10:00'),
    array['5e000000-0000-0000-0000-000000000001']::uuid[], null, 'Ana', null, null) $$),
  '42501',
  'anon creates nothing'
);

select * from finish();
rollback;
