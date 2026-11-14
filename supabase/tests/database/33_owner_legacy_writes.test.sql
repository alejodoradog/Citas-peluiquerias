-- Task 4.2b, migration close_owner_legacy_writes: the owner's session changes
-- appointments, their lines and a barber's blocks only through the functions
-- of task 4.2 (test 32). The old paths of decision 0006 are closed:
-- create_appointment, change_appointment_services and direct writes to
-- appointments, appointment_services and a barber's time_blocks. The
-- closures of the whole barbershop (D-59) are still written directly.
--
-- Also the founder's decision of 2026-11-13: an appointment that already
-- started does not move.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

-- Privileges -------------------------------------------------------------------------------

select ok(
  not has_function_privilege('authenticated',
    'public.create_appointment(uuid, uuid, uuid, timestamptz, uuid[], public.appointment_source, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.change_appointment_services(uuid, uuid[])', 'EXECUTE'),
  'a session no longer calls create_appointment or change_appointment_services'
);
select ok(
  has_function_privilege('service_role',
    'public.create_appointment(uuid, uuid, uuid, timestamptz, uuid[], public.appointment_source, text)', 'EXECUTE'),
  'the server key still does'
);
select ok(
  not has_table_privilege('authenticated', 'public.appointments', 'INSERT')
  and not has_table_privilege('authenticated', 'public.appointments', 'UPDATE')
  and not has_any_column_privilege('authenticated', 'public.appointments', 'UPDATE'),
  'a session neither inserts nor updates appointments, not even one column'
);
select ok(
  not has_table_privilege('authenticated', 'public.appointment_services', 'INSERT')
  and not has_table_privilege('authenticated', 'public.appointment_services', 'DELETE')
  and not has_any_column_privilege('authenticated', 'public.appointment_services', 'UPDATE'),
  'nor writes appointment lines'
);
select ok(
  has_column_privilege('authenticated', 'public.appointments', 'status', 'SELECT')
  and has_table_privilege('authenticated', 'public.appointment_services', 'SELECT'),
  'it still reads them'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.time_blocks', 'UPDATE'),
  'no session edits a block in place'
);

-- Fixtures, inserted as the table owner -----------------------------------------------------------
-- Barbershop A (owner a), open 06:00 to 22:00 every day, with Uno (Corte).

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com');
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Barbería A', 'viejas-a', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000000001', d, '06:00', '22:00' from generate_series(0, 6) d;
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Corte', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Uno',
   encode(sha256(convert_to('Uno viejas', 'UTF8')), 'hex'), 1, true);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001');
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', d, '06:00', '22:00'
from generate_series(0, 6) d;
insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Camila Rojas', 'camila@example.com');

-- The working days ahead (no Colombian holiday): wd 1 is the first one after
-- today. hh:mm Bogotá on working day n.
create temp table wd as
select (row_number() over (order by d))::integer as n, d::date as d
from generate_series(
  (private.today_bogota() + 1)::timestamp, (private.today_bogota() + 20)::timestamp, interval '1 day'
) d
where not private.is_colombian_holiday(d::date);
grant select on wd to authenticated;

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

-- The hint of the error a statement raises, its code if it has no hint or is
-- a missing privilege (newer Postgres adds a "Grant the required privileges"
-- hint to those), or 'no error'.
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
  if sqlstate = '42501' then
    return sqlstate;
  end if;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;

grant execute on function pg_temp.at(integer, text), pg_temp.day_at(integer, text), pg_temp.hint_of(text) to authenticated;

-- e1: confirmed, started about 15 minutes ago. e2: confirmed, working day 2
-- at 10:00. A block of Uno that day at 15:00, and a closure of the whole
-- barbershop 25 days ahead.
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', date_bin('15 minutes', now(), '2000-01-01') - interval '15 minutes',
   date_bin('15 minutes', now(), '2000-01-01') + interval '15 minutes', 25000, 'manual'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '10:00'), pg_temp.at(2, '10:30'), 25000, 'manual');
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, '5e000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 1, '5e000000-0000-0000-0000-000000000001');
insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('b1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
   pg_temp.at(2, '15:00'), pg_temp.at(2, '16:00'), 'Almuerzo'),
  ('b1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', null,
   pg_temp.day_at(25, '00:00'), pg_temp.day_at(26, '00:00'), 'Inventario');

-- Owner A, signed in ------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- The old paths
select is(
  pg_temp.hint_of($$ select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
      pg_temp.at(5, '10:00'), array['5e000000-0000-0000-0000-000000000001']::uuid[]) $$),
  '42501', 'the owner cannot call create_appointment'
);
select is(
  pg_temp.hint_of($$ select public.change_appointment_services('e0000000-0000-0000-0000-000000000002',
      array['5e000000-0000-0000-0000-000000000001']::uuid[]) $$),
  '42501', 'nor change_appointment_services'
);
select is(
  pg_temp.hint_of($$ update public.appointments set starts_at = starts_at + interval '1 hour',
      ends_at = ends_at + interval '1 hour' where id = 'e0000000-0000-0000-0000-000000000002' $$),
  '42501', 'nor move an appointment directly'
);
select is(
  pg_temp.hint_of($$ update public.appointments set status = 'no_show'
      where id = 'e0000000-0000-0000-0000-000000000002' $$),
  '42501', 'nor mark one directly, before it starts'
);
select is(
  pg_temp.hint_of($$ delete from public.appointment_services
      where appointment_id = 'e0000000-0000-0000-0000-000000000002' $$),
  '42501', 'nor take a service out of one directly'
);

-- A barber's blocks go through create_time_block and delete_time_block
select is(
  pg_temp.hint_of($$ insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
              pg_temp.at(2, '06:00'), pg_temp.at(2, '09:00'), 'Permiso') $$),
  '42501', 'the owner cannot insert a barber''s block directly'
);
delete from public.time_blocks where id = 'b1000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.time_blocks where id = 'b1000000-0000-0000-0000-000000000001'),
  1, 'nor delete one directly: the row stays'
);
select is(
  pg_temp.hint_of($$ update public.time_blocks set reason = 'Otro'
      where id = 'b1000000-0000-0000-0000-000000000002' $$),
  '42501', 'nor edit any block in place'
);
select is(
  pg_temp.hint_of($$ select public.delete_time_block('b1000000-0000-0000-0000-000000000001') $$),
  'no error', 'delete_time_block removes the barber''s block'
);
select is(
  pg_temp.hint_of($$ select public.create_time_block('aaaaaaaa-0000-0000-0000-000000000001',
      'ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '15:00'), pg_temp.at(2, '16:00'), 'Almuerzo') $$),
  'no error', 'and create_time_block makes it again'
);

-- The closures of the whole barbershop (D-59) stay direct
select is(
  pg_temp.hint_of($$ insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
      values ('aaaaaaaa-0000-0000-0000-000000000001', null,
              pg_temp.day_at(27, '00:00'), pg_temp.day_at(29, '00:00'), 'Vacaciones') $$),
  'no error', 'the owner closes the barbershop for several days directly'
);
delete from public.time_blocks where id = 'b1000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.time_blocks where id = 'b1000000-0000-0000-0000-000000000002'),
  0, 'and removes a closure directly'
);
reset role;
insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('b1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', null,
   pg_temp.day_at(-3, '00:00'), pg_temp.day_at(-2, '00:00'), 'Inventario');
set local role authenticated;
delete from public.time_blocks where id = 'b1000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from public.time_blocks where id = 'b1000000-0000-0000-0000-000000000003'),
  1, 'but not one that already ended'
);

-- An appointment that started does not move (founder, 2026-11-13)
select is(
  pg_temp.hint_of($$ select public.reschedule_appointment('e0000000-0000-0000-0000-000000000001',
      'ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '12:00')) $$),
  'already_started', 'a confirmed appointment that already started is not rescheduled'
);
select is(
  (select starts_at < now() from public.appointments where id = 'e0000000-0000-0000-0000-000000000001'),
  true, 'and it keeps its time'
);
select is(
  pg_temp.hint_of($$ select public.set_appointment_status('e0000000-0000-0000-0000-000000000001', 'no_show') $$),
  'no error', 'it is marked as missed instead'
);
select is(
  pg_temp.hint_of($$ select public.reschedule_appointment('e0000000-0000-0000-0000-000000000002',
      'ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '12:00')) $$),
  'no error', 'one that has not started still moves'
);

reset role;

select * from finish();
rollback;
