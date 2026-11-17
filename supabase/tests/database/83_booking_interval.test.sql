-- Task 7.11, migration add_booking_interval: the grid of times of each barbershop.
--
-- - booking_interval_minutes defaults to 15 and only accepts 15, 30 or 60.
-- - private.booking_time_problem refuses with slot_invalid a time off the grid.
-- - What customers do follows it: the public booking and "Cambiar mi cita".
-- - The owner stays free: their manual appointment and their reschedule.
-- - anon reads the column and never writes it; an owner changes the interval
--   of their own sede, not another's, not a suspended one.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

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
-- Owner A has S15 (default), S30, S60 and SUS (suspended). Owner B has OTRA.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000008301', 'dueno-a-intervalo@example.com'),
  ('00000000-0000-0000-0000-000000008302', 'dueno-b-intervalo@example.com');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-000000008301', 'Dueño A'),
  ('00000000-0000-0000-0000-000000008302', 'Dueño B');

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, booking_interval_minutes) values
  ('aaaaaaaa-0000-0000-0000-000000008315', 'Sede 15', 'sede-15-intervalo', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 15),
  ('aaaaaaaa-0000-0000-0000-000000008330', 'Sede 30', 'sede-30-intervalo', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 30),
  ('aaaaaaaa-0000-0000-0000-000000008360', 'Sede 60', 'sede-60-intervalo', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 60),
  ('bbbbbbbb-0000-0000-0000-000000008301', 'Otra sede', 'otra-sede-intervalo', '+573001112244',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 15);
-- The default: no value given.
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000008399', 'Sede sin valor', 'sede-sin-valor-intervalo', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
-- The one that is paused.
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, subscription_status, booking_interval_minutes) values
  ('aaaaaaaa-0000-0000-0000-000000008340', 'Sede pausada', 'sede-pausada-intervalo', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 'suspended', 30);

insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000008301', 'aaaaaaaa-0000-0000-0000-000000008315', 'owner'),
  ('00000000-0000-0000-0000-000000008301', 'aaaaaaaa-0000-0000-0000-000000008330', 'owner'),
  ('00000000-0000-0000-0000-000000008301', 'aaaaaaaa-0000-0000-0000-000000008360', 'owner'),
  ('00000000-0000-0000-0000-000000008301', 'aaaaaaaa-0000-0000-0000-000000008340', 'owner'),
  ('00000000-0000-0000-0000-000000008302', 'bbbbbbbb-0000-0000-0000-000000008301', 'owner');

insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select b.id, d, '06:00', '22:00'
from public.barbershops b, generate_series(0, 6) d
where b.slug like '%-intervalo';
insert into public.holiday_openings (barbershop_id, holiday_date)
select b.id, d::date
from public.barbershops b,
     generate_series(private.today_bogota() - 1, private.today_bogota() + 40, interval '1 day') d
where b.slug like '%-intervalo' and private.is_colombian_holiday(d::date);

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000008330', 'aaaaaaaa-0000-0000-0000-000000008330', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000008360', 'aaaaaaaa-0000-0000-0000-000000008360', 'Corte', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active) values
  ('ba000000-0000-0000-0000-000000008330', 'aaaaaaaa-0000-0000-0000-000000008330', 'Treinta', repeat('3', 64), 1, true),
  ('ba000000-0000-0000-0000-000000008360', 'aaaaaaaa-0000-0000-0000-000000008360', 'Sesenta', repeat('6', 64), 1, true);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000008330', 'ba000000-0000-0000-0000-000000008330', '5e000000-0000-0000-0000-000000008330'),
  ('aaaaaaaa-0000-0000-0000-000000008360', 'ba000000-0000-0000-0000-000000008360', '5e000000-0000-0000-0000-000000008360');
insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-000000008360', 'aaaaaaaa-0000-0000-0000-000000008360', 'Cliente Sesenta', 'sesenta@example.com');

-- 1. The column -------------------------------------------------------------------------------------

select is(
  (select booking_interval_minutes from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000008399'),
  15,
  'the interval is 15 by default'
);
select throws_ok(
  $$update public.barbershops set booking_interval_minutes = 45 where id = 'aaaaaaaa-0000-0000-0000-000000008399'$$,
  '23514', null, '45 is not accepted'
);
select throws_ok(
  $$update public.barbershops set booking_interval_minutes = 0 where id = 'aaaaaaaa-0000-0000-0000-000000008399'$$,
  '23514', null, '0 is not accepted'
);
select throws_ok(
  $$update public.barbershops set booking_interval_minutes = 90 where id = 'aaaaaaaa-0000-0000-0000-000000008399'$$,
  '23514', null, '90 is not accepted'
);

-- 2. booking_time_problem, with a fixed "now" --------------------------------------------------------
-- p_now: 06:00 of today in Bogotá; the starts are on day 2 (inside the window, past the notice).

select is(
  private.booking_time_problem('aaaaaaaa-0000-0000-0000-000000008315', pg_temp.at(2, '10:15'), 30, pg_temp.at(0, '06:00')),
  null, 'with 15, :15 is accepted'
);
select is(
  private.booking_time_problem('aaaaaaaa-0000-0000-0000-000000008330', pg_temp.at(2, '10:00'), 30, pg_temp.at(0, '06:00')),
  null, 'with 30, :00 is accepted'
);
select is(
  private.booking_time_problem('aaaaaaaa-0000-0000-0000-000000008330', pg_temp.at(2, '10:30'), 30, pg_temp.at(0, '06:00')),
  null, 'with 30, :30 is accepted'
);
select is(
  private.booking_time_problem('aaaaaaaa-0000-0000-0000-000000008330', pg_temp.at(2, '10:15'), 30, pg_temp.at(0, '06:00')),
  'slot_invalid', 'with 30, :15 is slot_invalid'
);
select is(
  private.booking_time_problem('aaaaaaaa-0000-0000-0000-000000008330', pg_temp.at(2, '10:45'), 30, pg_temp.at(0, '06:00')),
  'slot_invalid', 'with 30, :45 is slot_invalid'
);
select is(
  private.booking_time_problem('aaaaaaaa-0000-0000-0000-000000008360', pg_temp.at(2, '10:00'), 30, pg_temp.at(0, '06:00')),
  null, 'with 60, :00 is accepted'
);
select is(
  private.booking_time_problem('aaaaaaaa-0000-0000-0000-000000008360', pg_temp.at(2, '10:30'), 30, pg_temp.at(0, '06:00')),
  'slot_invalid', 'with 60, :30 is slot_invalid'
);

-- 3. The public booking, as anon -----------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment(p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000008330',
      p_barber_id => 'ba000000-0000-0000-0000-000000008330', p_starts_at => %L,
      p_service_ids => array['5e000000-0000-0000-0000-000000008330']::uuid[],
      p_customer_name => 'Camila Ruiz', p_customer_email => 'camila-intervalo@example.com',
      p_customer_phone => null, p_manage_token_hash => %L)$$,
    pg_temp.at(2, '10:15'), pg_temp.h('intervalo-rechazado'))),
  'slot_invalid',
  'with 30, anon cannot book at 10:15'
);
select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment(p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000008330',
      p_barber_id => 'ba000000-0000-0000-0000-000000008330', p_starts_at => %L,
      p_service_ids => array['5e000000-0000-0000-0000-000000008330']::uuid[],
      p_customer_name => 'Camila Ruiz', p_customer_email => 'camila-intervalo@example.com',
      p_customer_phone => null, p_manage_token_hash => %L)$$,
    pg_temp.at(2, '10:30'), pg_temp.h('token-intervalo'))),
  'no error',
  'with 30, anon books at 10:30'
);

-- 4. "Cambiar mi cita" --------------------------------------------------------------------------------

select is(
  pg_temp.hint_of(format($$select public.reschedule_appointment_by_token(%L, %L)$$,
    pg_temp.h('token-intervalo'), pg_temp.at(2, '11:15'))),
  'slot_invalid',
  'the customer cannot move their appointment off the grid (11:15 with 30)'
);
select is(
  pg_temp.hint_of(format($$select public.reschedule_appointment_by_token(%L, %L)$$,
    pg_temp.h('token-intervalo'), pg_temp.at(2, '11:30'))),
  'no error',
  'but moves it onto the grid (11:30)'
);

-- 5. The owner stays free ----------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008301", "role": "authenticated"}';

select is(
  pg_temp.hint_of($$select public.create_manual_appointment('aaaaaaaa-0000-0000-0000-000000008360',
    'ba000000-0000-0000-0000-000000008360', pg_temp.at(2, '10:15'),
    array['5e000000-0000-0000-0000-000000008360']::uuid[], 'c0000000-0000-0000-0000-000000008360', null, null, null)$$),
  'no error',
  'the owner creates an appointment at 10:15 in a sede with 60'
);
select is(
  pg_temp.hint_of($$select public.reschedule_appointment(
    (select id from public.appointments where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008360' limit 1),
    'ba000000-0000-0000-0000-000000008360', pg_temp.at(2, '14:15'))$$),
  'no error',
  'and moves it to 14:15 in the same sede'
);

-- 6. Permissions ---------------------------------------------------------------------------------------

-- The owner changes the interval of their own sede.
update public.barbershops set booking_interval_minutes = 60 where id = 'aaaaaaaa-0000-0000-0000-000000008315';
select is(
  (select booking_interval_minutes from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000008315'),
  60,
  'an owner changes the interval of their sede'
);

-- Not the one of another owner: 0 rows.
create function pg_temp.rows_updated(statement text)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function pg_temp.rows_updated(text) to authenticated;
select is(
  pg_temp.rows_updated($$update public.barbershops set booking_interval_minutes = 60
    where id = 'bbbbbbbb-0000-0000-0000-000000008301'$$),
  0,
  'an owner changes no interval of another sede (0 rows)'
);

-- Nor the one of their own suspended sede.
select is(
  pg_temp.rows_updated($$update public.barbershops set booking_interval_minutes = 60
    where id = 'aaaaaaaa-0000-0000-0000-000000008340'$$),
  0,
  'nor the interval of their own suspended sede (0 rows)'
);

reset role;
select is(
  (select array_agg(booking_interval_minutes order by id) from public.barbershops
   where id in ('bbbbbbbb-0000-0000-0000-000000008301', 'aaaaaaaa-0000-0000-0000-000000008340')),
  array[30, 15],
  'the other owner''s sede and the suspended sede keep their interval'
);

-- anon reads the column and never writes it.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is(
  (select booking_interval_minutes from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000008330'),
  30,
  'anon reads booking_interval_minutes'
);
select throws_ok(
  $$update public.barbershops set booking_interval_minutes = 60 where id = 'aaaaaaaa-0000-0000-0000-000000008330'$$,
  '42501', null,
  'anon cannot update it'
);

select * from finish();
rollback;
