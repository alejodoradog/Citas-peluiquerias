-- Task 3.4, migration add_manage_appointment: "Gestionar mi cita".
--
-- - managed_appointment shows a confirmed appointment that has not started,
--   to whoever has the hash of its link, and nothing for any other hash.
-- - cancel_appointment_by_token and reschedule_appointment_by_token work only
--   until the policy's notice, record the customer as the actor, and the
--   new time passes the rules of a public booking.
-- - A cancellation works with the barbershop suspended; moving does not.
-- - anon still reads no appointment.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);

-- Structure and privileges -------------------------------------------------------------------

select has_function('public', 'managed_appointment', array['text'], 'managed_appointment exists');
select has_function('public', 'cancel_appointment_by_token', array['text'], 'cancel_appointment_by_token exists');
select has_function(
  'public', 'reschedule_appointment_by_token', array['text', 'timestamp with time zone'],
  'reschedule_appointment_by_token exists'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.managed_appointment(text)'::regprocedure,
     'public.cancel_appointment_by_token(text)'::regprocedure,
     'public.reschedule_appointment_by_token(text, timestamptz)'::regprocedure
   )),
  'the three functions are security definer with an empty search_path'
);
select ok(
  has_function_privilege('anon', 'public.managed_appointment(text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.managed_appointment(text)', 'EXECUTE')
    and has_function_privilege('anon', 'public.cancel_appointment_by_token(text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.cancel_appointment_by_token(text)', 'EXECUTE')
    and has_function_privilege('anon', 'public.reschedule_appointment_by_token(text, timestamptz)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.reschedule_appointment_by_token(text, timestamptz)', 'EXECUTE'),
  'anon and authenticated call the three functions'
);
select ok(
  not has_function_privilege('anon', 'private.lock_managed_appointment(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.lock_managed_appointment(text)', 'EXECUTE'),
  'nobody calls the locking helper directly'
);
select is(
  (select pg_get_function_result('public.managed_appointment(text)'::regprocedure)),
  'TABLE(barbershop_id uuid, slug text, starts_at timestamp with time zone, ends_at timestamp with time zone, '
    'price_cop integer, barber_id uuid, barber_name text, service_names text[], customer_first_name text, '
    'cancellation_notice_hours integer, changeable boolean)',
  'managed_appointment returns what C-09 shows, and no email, phone or hash'
);

-- Fixtures, inserted as the table owner -----------------------------------------------------------
-- Shop S takes bookings: open every day 06:00-22:00 Bogotá and on every
-- holiday of the next weeks; notice of 60 minutes and 2 hours to cancel (the
-- defaults). Barbers Uno and Dos do Corte (30 min) and Barba (15 min).

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Barbería S', 'barberia-s', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000000001', d, '06:00', '22:00' from generate_series(0, 6) d;
insert into public.holiday_openings (barbershop_id, holiday_date)
select 'aaaaaaaa-0000-0000-0000-000000000001', d::date
from generate_series(private.today_bogota() - 1, private.today_bogota() + 40, interval '1 day') d
where private.is_colombian_holiday(d::date);
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Barba', 15000, 15, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Uno', repeat('1', 64), 1, true),
  ('ba000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dos', repeat('2', 64), 2, true);
insert into public.barber_services (barbershop_id, barber_id, service_id)
select 'aaaaaaaa-0000-0000-0000-000000000001', b, s
from unnest(array['ba000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002']::uuid[]) b,
     unnest(array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[]) s;
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at)
select 'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
  (((now() at time zone 'America/Bogota')::date + 3) + time '14:00') at time zone 'America/Bogota',
  (((now() at time zone 'America/Bogota')::date + 3) + time '15:00') at time zone 'America/Bogota';
insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Otra Persona', 'otra@example.com');

-- The instant of hh:mm Bogotá, `days` days from today in Bogotá.
create function pg_temp.at(days integer, hhmm text)
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

-- The hash of the link of a made-up token.
create function pg_temp.h(token text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;

grant execute on function pg_temp.at(integer, text), pg_temp.hint_of(text), pg_temp.h(text) to anon, authenticated;

-- An appointment the owner already has, at day 2 11:00 with Uno: moving onto
-- it must be refused.
insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '11:00'), pg_temp.at(2, '11:30'), 25000, 'manual');

-- From task 3.5 only the app server books; this test books as anon, the most
-- untrusted caller, so it grants it back inside this transaction only.
grant execute on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text) to anon;

-- The customer books as anon: Corte + Barba (45 min) with Uno, day 2 at 10:00.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  (select r.barber_id from public.book_appointment(
     p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000000001', p_barber_id => 'ba000000-0000-0000-0000-000000000001',
     p_starts_at => pg_temp.at(2, '10:00'),
     p_service_ids => array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[],
     p_customer_name => '  Camila Rojas Pérez ', p_customer_email => 'camila@example.com',
     p_manage_token_hash => pg_temp.h('token-camila')) r),
  'ba000000-0000-0000-0000-000000000001'::uuid,
  'the customer books with Uno'
);

-- managed_appointment ---------------------------------------------------------------------------

select results_eq(
  $$ select slug, starts_at, ends_at, price_cop, barber_name, service_names, customer_first_name,
            cancellation_notice_hours, changeable
     from public.managed_appointment(pg_temp.h('token-camila')) $$,
  $$ values ('barberia-s'::text, pg_temp.at(2, '10:00'), pg_temp.at(2, '10:45'), 40000, 'Uno'::text,
             array['Corte', 'Barba']::text[], 'Camila'::text, 2, true) $$,
  'the link shows the appointment, its services in order and only the first name'
);
select is((select count(*) from public.managed_appointment(pg_temp.h('otro-token')))::integer, 0, 'another hash shows nothing');
select is((select count(*) from public.managed_appointment('no-es-un-hash'))::integer, 0, 'a malformed hash shows nothing');
select is((select count(*) from public.managed_appointment(null))::integer, 0, 'nor null');
select is((select count(*) from public.managed_appointment(upper(pg_temp.h('token-camila'))))::integer, 0, 'nor the hash in capitals');

-- Moving ------------------------------------------------------------------------------------------

select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(2, '10:00')) $$),
  'same_time', 'the same time is not a change');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(2, '10:30')) $$),
  'slot_taken', 'nor onto another appointment of the barber');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(3, '13:30')) $$),
  'blocked', 'nor into a block');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(3, '05:00')) $$),
  'outside_hours', 'nor outside the hours');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(3, '10:10')) $$),
  'slot_invalid', 'nor off the quarter hours');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(31, '10:00')) $$),
  'outside_booking_window', 'nor past the booking window');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(-1, '10:00')) $$),
  'outside_booking_window', 'nor to the past');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), null) $$),
  'slot_invalid', 'nor to no time');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('otro-token'), pg_temp.at(3, '10:00')) $$),
  'link_invalid', 'another hash moves nothing');

select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(2, '09:30')) $$),
  'no error', 'moving over part of its own old time works');
select results_eq(
  $$ select starts_at, ends_at, changeable from public.managed_appointment(pg_temp.h('token-camila')) $$,
  $$ values (pg_temp.at(2, '09:30'), pg_temp.at(2, '10:15'), true) $$,
  'the appointment moved and kept its 45 minutes'
);
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(4, '16:00')) $$),
  'no error', 'moving to another day works');

select throws_ok('select id from public.appointments limit 1', '42501', null, 'anon still reads no appointment');

reset role;

-- The barber stops doing Barba: the appointment cannot move, and says why.
delete from public.barber_services
where barber_id = 'ba000000-0000-0000-0000-000000000001' and service_id = '5e000000-0000-0000-0000-000000000002';
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(5, '10:00')) $$),
  'services_changed', 'a barber who no longer does a service of the appointment cannot take it elsewhere');
select is(pg_temp.hint_of($$ select public.cancel_appointment_by_token(pg_temp.h('otro-token')) $$),
  'link_invalid', 'and that changes nothing for other links');
reset role;
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002');

select is(
  (select count(*) from public.appointments
   where manage_token_hash = pg_temp.h('token-camila')
     and barber_id = 'ba000000-0000-0000-0000-000000000001'
     and starts_at = pg_temp.at(4, '16:00') and ends_at = pg_temp.at(4, '16:45')
     and status = 'confirmed')::integer,
  1,
  'it is the same appointment, with the same barber'
);
select is(
  (select array_agg(e.actor::text order by e.created_at, e.id)
   from public.appointment_events e
   join public.appointments a on a.id = e.appointment_id
   where a.manage_token_hash = pg_temp.h('token-camila') and e.type = 'rescheduled'),
  array['customer', 'customer'],
  'each move is in the history, by the customer'
);

-- The notice ------------------------------------------------------------------------------------
-- Two appointments inserted by the owner: one in 30 to 90 minutes (inside the 2
-- hours to cancel) and one that already started.

insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, manage_token_hash)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002',
   date_trunc('hour', now()) + interval '90 minutes', date_trunc('hour', now()) + interval '2 hours',
   25000, 'web', pg_temp.h('token-pronto')),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002',
   now() - interval '10 minutes', now() + interval '20 minutes', 25000, 'web', pg_temp.h('token-empezo'));

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

-- date_trunc('hour') + 90 min is 30 to 90 minutes away: inside the 2 hours.
select is((select changeable from public.managed_appointment(pg_temp.h('token-pronto'))), false,
  'inside the 2 hours the link still shows the appointment, but not as changeable');
select is(pg_temp.hint_of($$ select public.cancel_appointment_by_token(pg_temp.h('token-pronto')) $$),
  'too_late', 'it can no longer be cancelled');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-pronto'), pg_temp.at(5, '10:00')) $$),
  'too_late', 'nor moved');
select is((select count(*) from public.managed_appointment(pg_temp.h('token-empezo')))::integer, 0,
  'an appointment that started shows nothing');
select is(pg_temp.hint_of($$ select public.cancel_appointment_by_token(pg_temp.h('token-empezo')) $$),
  'link_invalid', 'nor can be cancelled');

-- Cancelling --------------------------------------------------------------------------------------

select is(pg_temp.hint_of($$ select public.cancel_appointment_by_token(pg_temp.h('otro-token')) $$),
  'link_invalid', 'another hash cancels nothing');
select is(pg_temp.hint_of($$ select public.cancel_appointment_by_token(null) $$),
  'link_invalid', 'nor null');
select is(pg_temp.hint_of($$ select public.cancel_appointment_by_token(pg_temp.h('token-camila')) $$),
  'no error', 'the customer cancels');
select is((select count(*) from public.managed_appointment(pg_temp.h('token-camila')))::integer, 0,
  'a cancelled appointment shows nothing');
select is(pg_temp.hint_of($$ select public.cancel_appointment_by_token(pg_temp.h('token-camila')) $$),
  'link_invalid', 'nor is cancelled twice');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-camila'), pg_temp.at(5, '10:00')) $$),
  'link_invalid', 'nor moved');

reset role;

select results_eq(
  $$ select a.status::text, e.actor::text
     from public.appointments a
     join public.appointment_events e on e.appointment_id = a.id and e.type = 'status_changed'
     where a.manage_token_hash = pg_temp.h('token-camila') $$,
  $$ values ('cancelled_by_customer'::text, 'customer'::text) $$,
  'the appointment is cancelled by the customer, in the history'
);

-- A suspended barbershop --------------------------------------------------------------------------

insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, manage_token_hash)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002',
   pg_temp.at(6, '10:00'), pg_temp.at(6, '10:30'), 25000, 'web', pg_temp.h('token-a')),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002',
   pg_temp.at(7, '10:00'), pg_temp.at(7, '10:30'), 25000, 'web', pg_temp.h('token-b'));
update public.barbershops set subscription_status = 'suspended'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is((select count(*) from public.managed_appointment(pg_temp.h('token-a')))::integer, 1,
  'with the barbershop suspended the link still shows the appointment');
select is(pg_temp.hint_of($$ select public.reschedule_appointment_by_token(pg_temp.h('token-a'), pg_temp.at(8, '10:00')) $$),
  'not_accepting', 'but it cannot be moved');
select is(pg_temp.hint_of($$ select public.cancel_appointment_by_token(pg_temp.h('token-b')) $$),
  'no error', 'it can still be cancelled');

reset role;

-- A deleted barbershop: its links show nothing.
update public.barbershops set subscription_status = 'trial', deleted_at = now()
where id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is((select count(*) from public.managed_appointment(pg_temp.h('token-a')))::integer, 0,
  'a deleted barbershop shows nothing');
select is(pg_temp.hint_of($$ select public.cancel_appointment_by_token(pg_temp.h('token-a')) $$),
  'link_invalid', 'and cancels nothing');

reset role;

select * from finish();
rollback;
