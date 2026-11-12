-- Task 3.5, migration add_booking_limits: limits on public bookings.
--
-- - Only the app's server (service_role) books; anon and authenticated
--   execute neither book_appointment nor book_appointment_from_app.
-- - At most 5 upcoming web appointments per customer in a barbershop;
--   past, cancelled and manual ones do not count, and manual ones are never
--   limited.
-- - At most 10 bookings per hour from one IP hash in a barbershop; other IPs,
--   other barbershops, older hits and an unknown IP are not limited.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

-- Structure and privileges -------------------------------------------------------------------

select has_function(
  'public', 'book_appointment_from_app',
  array['uuid', 'timestamp with time zone', 'uuid[]', 'text', 'text', 'text', 'uuid', 'text', 'text'],
  'book_appointment_from_app exists'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc
   where oid = 'public.book_appointment_from_app(uuid, timestamptz, uuid[], text, text, text, uuid, text, text)'::regprocedure),
  'it is security definer with an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.book_appointment_from_app(uuid, timestamptz, uuid[], text, text, text, uuid, text, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.book_appointment_from_app(uuid, timestamptz, uuid[], text, text, text, uuid, text, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text)', 'EXECUTE'),
  'anon and authenticated book through neither function'
);
select ok(
  has_function_privilege('service_role', 'public.book_appointment_from_app(uuid, timestamptz, uuid[], text, text, text, uuid, text, text)', 'EXECUTE'),
  'the app server books'
);
select is(
  (select relrowsecurity from pg_class where oid = 'private.booking_ip_hits'::regclass),
  true,
  'the IP hits have RLS, with no policy: nobody reads them through the API'
);
select is(private.max_bookings_per_ip_hour(), 10, 'MAX_BOOKINGS_PER_IP_HOUR');
select is(private.max_upcoming_web_per_customer(), 5, 'MAX_UPCOMING_WEB_PER_CUSTOMER');

-- Fixtures ------------------------------------------------------------------------------------
-- Shops S and T open every day 06:00-22:00 Bogotá and every holiday; one
-- barber each who does Corte (30 min).

insert into public.barbershops (id, name, slug, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Barbería S', 'barberia-s', private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Barbería T', 'barberia-t', private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select s, d, '06:00', '22:00'
from unnest(array['aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001']::uuid[]) s,
     generate_series(0, 6) d;
insert into public.holiday_openings (barbershop_id, holiday_date)
select s, d::date
from unnest(array['aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001']::uuid[]) s,
     generate_series(private.today_bogota() - 1, private.today_bogota() + 40, interval '1 day') d
where private.is_colombian_holiday(d::date);
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'Corte', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Uno', repeat('1', 64), 1, true),
  ('ba000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'Otro', repeat('2', 64), 1, true);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-0000000000b1', '5e000000-0000-0000-0000-0000000000b1');

create function pg_temp.at(days integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'America/Bogota')::date + days) + hhmm::time) at time zone 'America/Bogota'
$$;

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

-- A booking through the app, as a statement.
create function pg_temp.book(
  starts timestamptz,
  customer_email text,
  ip text,
  shop uuid default 'aaaaaaaa-0000-0000-0000-000000000001',
  service uuid default '5e000000-0000-0000-0000-000000000001'
)
returns text
language sql
volatile
as $$
  select format(
    'select * from public.book_appointment_from_app(p_barbershop_id => %L, p_starts_at => %L, p_service_ids => %L, '
    'p_customer_name => %L, p_customer_email => %L, p_manage_token_hash => %L, p_client_ip_hash => %L)',
    shop, starts, array[service], 'Camila Ruiz', customer_email,
    encode(sha256(gen_random_uuid()::text::bytea), 'hex'), ip
  )
$$;

create function pg_temp.ip(name text)
returns text
language sql
immutable
as $$ select encode(sha256(convert_to(name, 'UTF8')), 'hex') $$;

grant execute on function pg_temp.at(integer, text), pg_temp.hint_of(text),
  pg_temp.book(timestamptz, text, text, uuid, uuid), pg_temp.ip(text) to service_role, anon;

-- anon cannot book at all -------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(2, '10:00'), 'a@example.com', null)), '42501',
  'anon cannot call book_appointment_from_app');
select is(pg_temp.hint_of($$ select * from public.book_appointment(
    p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000000001', p_starts_at => pg_temp.at(2, '10:00'),
    p_service_ids => array['5e000000-0000-0000-0000-000000000001']::uuid[], p_customer_name => 'X',
    p_customer_email => 'x@example.com', p_manage_token_hash => repeat('a', 64)) $$),
  '42501', 'nor book_appointment directly');
reset role;

-- Upcoming appointments per customer ---------------------------------------------------------

set local role service_role;

select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(2, '08:00'), 'camila@example.com', null)), 'no error', 'the 1st booking');
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(2, '09:00'), 'camila@example.com', null)), 'no error', 'the 2nd');
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(3, '09:00'), 'Camila@Example.com', null)), 'no error', 'the 3rd, the same email in capitals');
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(4, '09:00'), 'camila@example.com', null)), 'no error', 'the 4th');
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(5, '09:00'), 'camila@example.com', null)), 'no error', 'the 5th');
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(6, '09:00'), 'camila@example.com', null)), 'too_many_upcoming',
  'the 6th upcoming appointment of the same email is refused');
select is(
  pg_temp.hint_of(pg_temp.book(pg_temp.at(6, '09:00'), 'camila@example.com', null,
    'bbbbbbbb-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-0000000000b1')),
  'no error', 'in another barbershop the same email books'
);

reset role;
-- One of them is cancelled, so there is room again; a manual appointment for
-- the same customer is not limited and does not count.
update public.appointments set status = 'cancelled_by_customer'
where id = (
  select a.id from public.appointments a
  join public.customers c on c.id = a.customer_id
  where c.email = 'camila@example.com' and a.barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  order by a.starts_at desc limit 1
);
insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
select 'aaaaaaaa-0000-0000-0000-000000000001', c.id, 'ba000000-0000-0000-0000-000000000001',
  pg_temp.at(8, '09:00'), pg_temp.at(8, '09:30'), 25000, 'manual'
from public.customers c
where c.email = 'camila@example.com' and c.barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role service_role;
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(7, '09:00'), 'camila@example.com', null)), 'no error',
  'a cancelled appointment and a manual one do not count');
reset role;

-- Bookings per IP ---------------------------------------------------------------------------
-- 10 bookings from the same IP, each with its own email.

set local role service_role;
select is(
  (select count(*) from generate_series(1, 10) n
   where pg_temp.hint_of(pg_temp.book(pg_temp.at(10, '06:00') + make_interval(mins => 30 * n),
                                      format('ip%s@example.com', n), pg_temp.ip('1.2.3.4'))) = 'no error')::integer,
  10, '10 bookings from one IP in an hour'
);
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(11, '09:00'), 'ip11@example.com', pg_temp.ip('1.2.3.4'))),
  'too_many_from_ip', 'the 11th is refused');
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(11, '09:00'), 'ip11@example.com', pg_temp.ip('5.6.7.8'))),
  'no error', 'another IP books');
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(11, '10:00'), 'ip12@example.com', null)),
  'no error', 'an unknown IP is not limited');
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(11, '11:00'), 'ip13@example.com', 'no-es-un-hash')),
  'slot_invalid', 'a malformed IP hash is refused');
reset role;

-- The hits of more than an hour ago no longer count; those of more than a day
-- go away on the next booking.
update private.booking_ip_hits set created_at = now() - interval '2 hours'
where ip_hash = pg_temp.ip('1.2.3.4');
insert into private.booking_ip_hits (barbershop_id, ip_hash, created_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.ip('viejo'), now() - interval '25 hours');

set local role service_role;
select is(pg_temp.hint_of(pg_temp.book(pg_temp.at(12, '09:00'), 'ip14@example.com', pg_temp.ip('1.2.3.4'))),
  'no error', 'an hour later the same IP books again');
reset role;
select is((select count(*) from private.booking_ip_hits where ip_hash = pg_temp.ip('viejo'))::integer, 0,
  'hits older than a day are deleted');

select * from finish();
rollback;
