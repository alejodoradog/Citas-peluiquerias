-- Task 8.15, migration widen_booking_interval: the interval also takes 5 and 10.
--
-- - booking_interval_minutes accepts 5 and 10 as well as 15, 30 and 60; 20 and 0 are refused.
-- - book_appointment, as anon, refuses a time off the grid of 5 or 10 with slot_invalid
--   and accepts a time on it.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

-- Helpers ----------------------------------------------------------------------------------------

create function pg_temp.h(token text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;

-- The instant of hh:mm Bogotá, `days` days from today in Bogotá.
create function pg_temp.at(days integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'America/Bogota')::date + days) + hhmm::time) at time zone 'America/Bogota'
$$;

-- The hint of the error a statement raises (or its SQLSTATE), or 'no error'.
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

grant execute on function pg_temp.h(text), pg_temp.at(integer, text), pg_temp.hint_of(text)
  to anon, authenticated;

-- From task 3.5 only the app server books; this test books as anon, the most
-- untrusted caller, so it grants it back inside this transaction only.
grant execute on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text) to anon;

-- Fixtures, inserted as the table owner -------------------------------------------------------
-- Sede 5 has an interval of 5, sede 10 one of 10.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000008411', 'dueno-intervalo-corto@example.com');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-000000008411', 'Dueño corto');

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, booking_interval_minutes) values
  ('aaaaaaaa-0000-0000-0000-000000008405', 'Sede 5', 'sede-5-intervalo-corto', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 15),
  ('aaaaaaaa-0000-0000-0000-000000008410', 'Sede 10', 'sede-10-intervalo-corto', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 15);

insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000008411', 'aaaaaaaa-0000-0000-0000-000000008405', 'owner'),
  ('00000000-0000-0000-0000-000000008411', 'aaaaaaaa-0000-0000-0000-000000008410', 'owner');

insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select b.id, d, '06:00', '22:00'
from public.barbershops b, generate_series(0, 6) d
where b.slug like '%-intervalo-corto';
insert into public.holiday_openings (barbershop_id, holiday_date)
select b.id, d::date
from public.barbershops b,
     generate_series(private.today_bogota() - 1, private.today_bogota() + 40, interval '1 day') d
where b.slug like '%-intervalo-corto' and private.is_colombian_holiday(d::date);

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000008405', 'aaaaaaaa-0000-0000-0000-000000008405', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000008410', 'aaaaaaaa-0000-0000-0000-000000008410', 'Corte', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active) values
  ('ba000000-0000-0000-0000-000000008405', 'aaaaaaaa-0000-0000-0000-000000008405', 'Cinco', repeat('5', 64), 1, true),
  ('ba000000-0000-0000-0000-000000008410', 'aaaaaaaa-0000-0000-0000-000000008410', 'Diez', repeat('1', 64), 1, true);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000008405', 'ba000000-0000-0000-0000-000000008405', '5e000000-0000-0000-0000-000000008405'),
  ('aaaaaaaa-0000-0000-0000-000000008410', 'ba000000-0000-0000-0000-000000008410', '5e000000-0000-0000-0000-000000008410');

-- 1. The column -------------------------------------------------------------------------------------

select lives_ok(
  $$update public.barbershops set booking_interval_minutes = 5 where id = 'aaaaaaaa-0000-0000-0000-000000008405'$$,
  'the interval accepts 5'
);
select lives_ok(
  $$update public.barbershops set booking_interval_minutes = 10 where id = 'aaaaaaaa-0000-0000-0000-000000008410'$$,
  'the interval accepts 10'
);
select throws_ok(
  $$update public.barbershops set booking_interval_minutes = 20 where id = 'aaaaaaaa-0000-0000-0000-000000008405'$$,
  '23514', null, '20 is not accepted'
);
select throws_ok(
  $$update public.barbershops set booking_interval_minutes = 0 where id = 'aaaaaaaa-0000-0000-0000-000000008405'$$,
  '23514', null, '0 is not accepted'
);

-- 2. The public booking, as anon -----------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment(p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000008405',
      p_barber_id => 'ba000000-0000-0000-0000-000000008405', p_starts_at => %L,
      p_service_ids => array['5e000000-0000-0000-0000-000000008405']::uuid[],
      p_customer_name => 'Laura Mora', p_customer_email => 'laura-intervalo-corto@example.com',
      p_customer_phone => null, p_manage_token_hash => %L)$$,
    pg_temp.at(2, '10:07'), pg_temp.h('intervalo-5-rechazado'))),
  'slot_invalid',
  'with 5, anon cannot book at 10:07'
);
select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment(p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000008410',
      p_barber_id => 'ba000000-0000-0000-0000-000000008410', p_starts_at => %L,
      p_service_ids => array['5e000000-0000-0000-0000-000000008410']::uuid[],
      p_customer_name => 'Tomás Pérez', p_customer_email => 'tomas-intervalo-corto@example.com',
      p_customer_phone => null, p_manage_token_hash => %L)$$,
    pg_temp.at(2, '10:05'), pg_temp.h('intervalo-10-rechazado'))),
  'slot_invalid',
  'with 10, anon cannot book at 10:05'
);
select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment(p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000008405',
      p_barber_id => 'ba000000-0000-0000-0000-000000008405', p_starts_at => %L,
      p_service_ids => array['5e000000-0000-0000-0000-000000008405']::uuid[],
      p_customer_name => 'Laura Mora', p_customer_email => 'laura-intervalo-corto@example.com',
      p_customer_phone => null, p_manage_token_hash => %L)$$,
    pg_temp.at(2, '10:05'), pg_temp.h('intervalo-5-aceptado'))),
  'no error',
  'with 5, anon books at 10:05'
);
select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment(p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000008410',
      p_barber_id => 'ba000000-0000-0000-0000-000000008410', p_starts_at => %L,
      p_service_ids => array['5e000000-0000-0000-0000-000000008410']::uuid[],
      p_customer_name => 'Tomás Pérez', p_customer_email => 'tomas-intervalo-corto@example.com',
      p_customer_phone => null, p_manage_token_hash => %L)$$,
    pg_temp.at(2, '10:20'), pg_temp.h('intervalo-10-aceptado'))),
  'no error',
  'with 10, anon books at 10:20'
);

-- The same 10:05 on another day: the grid is the same every day.
select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment(p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000008410',
      p_barber_id => 'ba000000-0000-0000-0000-000000008410', p_starts_at => %L,
      p_service_ids => array['5e000000-0000-0000-0000-000000008410']::uuid[],
      p_customer_name => 'Tomás Pérez', p_customer_email => 'tomas-intervalo-corto@example.com',
      p_customer_phone => null, p_manage_token_hash => %L)$$,
    pg_temp.at(3, '10:05'), pg_temp.h('intervalo-10-otro-dia'))),
  'slot_invalid',
  'with 10, anon cannot book at 10:05 on another day'
);

-- Customers may move to the 5-minute grid of their sede (task 7.11 rule, now at 5).
select is(
  pg_temp.hint_of(format($$select public.reschedule_appointment_by_token(%L, %L)$$,
    pg_temp.h('intervalo-5-aceptado'), pg_temp.at(2, '11:07'))),
  'slot_invalid',
  'with 5, the customer cannot move to 11:07'
);
select is(
  pg_temp.hint_of(format($$select public.reschedule_appointment_by_token(%L, %L)$$,
    pg_temp.h('intervalo-5-aceptado'), pg_temp.at(2, '11:10'))),
  'no error',
  'with 5, the customer moves to 11:10'
);

-- anon reads the column and never writes it.
select is(
  (select booking_interval_minutes from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000008410'),
  10,
  'anon reads booking_interval_minutes as 10'
);
select throws_ok(
  $$update public.barbershops set booking_interval_minutes = 5 where id = 'aaaaaaaa-0000-0000-0000-000000008410'$$,
  '42501', null,
  'anon cannot update it'
);

select * from finish();
rollback;
