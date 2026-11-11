-- Tasks 3.2 and 3.3, migration add_public_booking: the public booking.
--
-- - barbershop_accepts_bookings follows the phase of decision 0006 and never
--   accepts a deleted barbershop.
-- - booking_busy_ranges gives ranges and nothing else.
-- - book_appointment: anon books and creates the customer; an existing
--   customer is never changed; a taken slot answers slot_taken; "el primero
--   disponible" picks the barber with the fewest appointments and respects
--   the services; the rules of the engine (window, notice, quarter hours,
--   hours, holidays, blocks) hold in SQL; untrusted input is refused; anon
--   still reads no appointment or customer; only the token's hash is stored.
-- - The engine cases: the same fixture and cases run through
--   availableSlots in src/modulos/agenda/dominio/booking-rules.sql.test.ts
--   (decision 0005, point 16). Keep the JSON between the markers valid.
-- - The Colombian holidays of SQL against the list festivos.ts gives, which
--   src/lib/fechas/festivos.sql.test.ts compares.
--
-- The concurrent cases (two bookings of the same slot at once, double click,
-- a cancellation and a booking at once) need two sessions; pgTAP runs one.
-- They are described in docs/tareas/3.2-3.3-reservas.md.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(101);

-- Structure and privileges -------------------------------------------------------------------

select has_function('public', 'barbershop_accepts_bookings', array['uuid'], 'barbershop_accepts_bookings exists');
select has_function('public', 'booking_busy_ranges', array['uuid', 'timestamp with time zone', 'timestamp with time zone'], 'booking_busy_ranges exists');
select has_function(
  'public', 'book_appointment',
  array['uuid', 'timestamp with time zone', 'uuid[]', 'text', 'text', 'text', 'uuid', 'text'],
  'book_appointment exists'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.barbershop_accepts_bookings(uuid)'::regprocedure,
     'public.booking_busy_ranges(uuid, timestamptz, timestamptz)'::regprocedure,
     'public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text)'::regprocedure
   )),
  'the three public functions are security definer with an empty search_path'
);
select ok(
  (select bool_and(proconfig @> array['search_path=""'])
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname in ('barbershop_phase', 'easter_sunday', 'colombian_holidays', 'is_colombian_holiday',
                       'booking_window_days', 'booking_time_problem', 'barber_open_spans', 'barber_slot_problem')),
  'the private helpers have an empty search_path'
);
select ok(
  has_function_privilege('anon', 'public.barbershop_accepts_bookings(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.barbershop_accepts_bookings(uuid)', 'EXECUTE')
    and has_function_privilege('anon', 'public.booking_busy_ranges(uuid, timestamptz, timestamptz)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.booking_busy_ranges(uuid, timestamptz, timestamptz)', 'EXECUTE')
    and has_function_privilege('anon', 'public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text)', 'EXECUTE'),
  'anon and authenticated call the three public functions'
);
select ok(
  not has_function_privilege('anon', 'private.booking_time_problem(uuid, timestamptz, integer, timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'private.barber_slot_problem(uuid, uuid, timestamptz, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.barber_open_spans(uuid, uuid, date)', 'EXECUTE')
    and not has_function_privilege('anon', 'private.barbershop_phase(public.subscription_status, text, date, date, date)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.create_appointment(uuid, uuid, uuid, timestamptz, uuid[], public.appointment_source, text)', 'EXECUTE'),
  'anon calls none of the helpers, nor create_appointment directly'
);
select is(
  (select pg_get_function_result('public.booking_busy_ranges(uuid, timestamptz, timestamptz)'::regprocedure)),
  'TABLE(barber_id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone)',
  'booking_busy_ranges returns the barber and the range, nothing else'
);

-- Fixtures, inserted as the table owner -----------------------------------------------------------
-- Shop S takes bookings: open every day 06:00-22:00 Bogotá and on every
-- holiday of the next weeks, notice of 60 minutes (the default).
-- Barbers: B1 (sort 1) and B2 (sort 2) do Corte and Barba; B3 is inactive;
-- B4 does Corte only. Shop O is another barbershop with its owner.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-s@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-o@example.com');
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Barbería S', 'barberia-s', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Barbería O', 'barberia-o', '+573001112244',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño S'),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño O');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner');

insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000000001', d, '06:00', '22:00' from generate_series(0, 6) d;
insert into public.holiday_openings (barbershop_id, holiday_date)
select 'aaaaaaaa-0000-0000-0000-000000000001', d::date
from generate_series(private.today_bogota() - 1, private.today_bogota() + 40, interval '1 day') d
where private.is_colombian_holiday(d::date);

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Barba', 15000, 15, true),
  ('5e000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Viejo', 10000, 30, false),
  ('5e000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Largo', 20000, 240, true),
  ('5e000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tinte', 20000, 240, true),
  ('5e000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cejas', 8000, 10, true),
  ('5e000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'Corte O', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Uno', repeat('1', 64), 1, true),
  ('ba000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dos', repeat('2', 64), 2, true),
  ('ba000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tres', repeat('3', 64), 3, true),
  ('ba000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cuatro', repeat('4', 64), 4, true),
  ('ba000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'Otro', repeat('5', 64), 1, true);
insert into public.barber_services (barbershop_id, barber_id, service_id)
select 'aaaaaaaa-0000-0000-0000-000000000001', b, s
from unnest(array['ba000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002',
                  'ba000000-0000-0000-0000-000000000003']::uuid[]) b,
     unnest(array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002',
                  '5e000000-0000-0000-0000-000000000004', '5e000000-0000-0000-0000-000000000005',
                  '5e000000-0000-0000-0000-000000000006']::uuid[]) s;
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000004', '5e000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-0000000000b1', '5e000000-0000-0000-0000-0000000000b1');
update public.barbers set active = false where id = 'ba000000-0000-0000-0000-000000000003';

-- A customer the owner already has: the public booking must not change it.
insert into public.customers (id, barbershop_id, full_name, email, phone, notes) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Nombre Original', 'existente@example.com', '+573001110000', 'Prefiere la máquina 2');

-- The instant of hh:mm Bogotá, `days` days from today in Bogotá (anon has
-- no usage on the private schema, so not private.today_bogota).
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

-- A booking at S as a statement; the token hash differs on every call.
create function pg_temp.book(
  barber uuid,
  starts timestamptz,
  services uuid[] default array['5e000000-0000-0000-0000-000000000001']::uuid[],
  customer_email text default 'nueva@example.com',
  customer_name text default 'Camila Ruiz',
  customer_phone text default null,
  token_hash text default null,
  shop uuid default 'aaaaaaaa-0000-0000-0000-000000000001'
)
returns text
language sql
volatile
as $$
  select format(
    'select * from public.book_appointment(p_barbershop_id => %L, p_barber_id => %L, p_starts_at => %L, p_service_ids => %L, '
    'p_customer_name => %L, p_customer_email => %L, p_customer_phone => %L, p_manage_token_hash => %L)',
    shop, barber, starts, services, customer_name, customer_email, customer_phone,
    coalesce(token_hash, encode(sha256(gen_random_uuid()::text::bytea), 'hex'))
  )
$$;

grant execute on function pg_temp.at(integer, text), pg_temp.hint_of(text),
  pg_temp.book(uuid, timestamptz, uuid[], text, text, text, text, uuid) to anon, authenticated;

-- barbershop_accepts_bookings ----------------------------------------------------------------------

insert into public.barbershops (id, name, slug, trial_ends_on, expires_on, created_at, subscription_status, plan, deleted_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'Suspendida', 'suspendida-x', private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '30 days', 'suspended', null, null),
  ('dddddddd-0000-0000-0000-000000000002', 'Vencida', 'vencida-x', private.today_bogota() - 6, private.today_bogota() - 6, now() - interval '30 days', 'trial', null, null),
  ('dddddddd-0000-0000-0000-000000000003', 'Gracia', 'gracia-x', private.today_bogota() - 5, private.today_bogota() - 5, now() - interval '30 days', 'trial', null, null),
  ('dddddddd-0000-0000-0000-000000000004', 'Espera pago', 'espera-pago-x', private.today_bogota() - 10, private.today_bogota() - 10, now(), 'trial', null, null),
  ('dddddddd-0000-0000-0000-000000000005', 'Eliminada', 'eliminada-x', private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '30 days', 'trial', null, now());

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select ok(public.barbershop_accepts_bookings('aaaaaaaa-0000-0000-0000-000000000001'), 'a barbershop in its trial takes bookings');
select ok(not public.barbershop_accepts_bookings('dddddddd-0000-0000-0000-000000000001'), 'a suspended one does not');
select ok(not public.barbershop_accepts_bookings('dddddddd-0000-0000-0000-000000000002'), 'nor one on the 6th day after expiring');
select ok(public.barbershop_accepts_bookings('dddddddd-0000-0000-0000-000000000003'), 'the 5th day of grace still does');
select ok(not public.barbershop_accepts_bookings('dddddddd-0000-0000-0000-000000000004'), 'a sede created after the trial waits for its first payment');
select ok(not public.barbershop_accepts_bookings('dddddddd-0000-0000-0000-000000000005'), 'a deleted barbershop never does');
select ok(not public.barbershop_accepts_bookings('99999999-0000-0000-0000-000000000000'), 'an unknown id does not');
select ok(not public.barbershop_accepts_bookings(null), 'nor null');

-- A booking by anon ----------------------------------------------------------------------------------

select is(
  (select r.barber_id from public.book_appointment(
     p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000000001', p_barber_id => 'ba000000-0000-0000-0000-000000000001', p_starts_at => pg_temp.at(2, '10:00'),
     p_service_ids => array['5e000000-0000-0000-0000-000000000001']::uuid[],
     p_customer_name => 'Camila Ruiz', p_customer_email => '  Camila.Ruiz@Example.COM ', p_customer_phone => '+573001234567',
     p_manage_token_hash => repeat('ab', 32)) r),
  'ba000000-0000-0000-0000-000000000001'::uuid,
  'anon books the chosen barber and gets the barber back'
);

reset role;
select is(
  (select row(a.source, a.status, a.ends_at - a.starts_at, a.price_cop)::text
   from public.appointments a where a.manage_token_hash = repeat('ab', 32)),
  row('web'::public.appointment_source, 'confirmed'::public.appointment_status, interval '30 minutes', 25000)::text,
  'the appointment is web, confirmed, as long and as expensive as its service'
);
select is(
  (select row(c.full_name, c.email, c.phone)::text
   from public.customers c
   join public.appointments a on a.customer_id = c.id
   where a.manage_token_hash = repeat('ab', 32)),
  row('Camila Ruiz', 'camila.ruiz@example.com', '+573001234567')::text,
  'a new customer is created with the email trimmed and in lowercase'
);
select is(
  (select count(*)::int from public.appointment_services l
   join public.appointments a on a.id = l.appointment_id
   where a.manage_token_hash = repeat('ab', 32)),
  1,
  'with its line'
);
select is(
  (select count(*)::int from public.appointments a where a.manage_token_hash ~ '^[0-9a-f]{64}$' and a.source = 'web'),
  1,
  'only the hash of the manage token is stored (never the token)'
);

-- The existing customer is used, never changed.
set local role anon;
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000002', pg_temp.at(2, '10:00'),
    customer_email => 'EXISTENTE@example.com', customer_name => 'Otro Nombre',
    customer_phone => '+573009999999', token_hash => repeat('cd', 32))),
  'no error',
  'a booking with the email of an existing customer works'
);
reset role;
select is(
  (select row(c.full_name, c.email, c.phone, c.notes)::text from public.customers c
   where c.id = 'c0000000-0000-0000-0000-000000000001'),
  row('Nombre Original', 'existente@example.com', '+573001110000', 'Prefiere la máquina 2')::text,
  'and does not change the customer'
);
select is(
  (select a.customer_id from public.appointments a where a.manage_token_hash = repeat('cd', 32)),
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'the appointment belongs to that customer'
);
select is(
  (select count(*)::int from public.customers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  2,
  'no second customer with the same email'
);

-- The slot is taken ----------------------------------------------------------------------------------

set local role anon;
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '10:00'))),
  'slot_taken',
  'the same barber at the same time: slot_taken'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '09:45'))),
  'slot_taken',
  'a booking that overlaps the start: slot_taken'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '10:30'))),
  'no error',
  'the slot right after (half-open ranges) is free'
);
-- Both active barbers are now taken at 10:00 of day 2; B4 does Corte and is free.
select is(
  (select r.barber_id from public.book_appointment(
     p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000000001', p_barber_id => null, p_starts_at => pg_temp.at(2, '10:00'),
     p_service_ids => array['5e000000-0000-0000-0000-000000000001']::uuid[],
     p_customer_name => 'Ana', p_customer_email => 'ana@example.com', p_customer_phone => null,
     p_manage_token_hash => encode(sha256('only-free'::bytea), 'hex')) r),
  'ba000000-0000-0000-0000-000000000004'::uuid,
  '"el primero disponible" takes the only barber still free'
);
select is(
  pg_temp.hint_of(pg_temp.book(null, pg_temp.at(2, '10:00'))),
  'slot_taken',
  'and when nobody is free: slot_taken'
);
reset role;
-- A cancelled appointment frees the slot.
update public.appointments set status = 'cancelled_by_barbershop'
where manage_token_hash = repeat('ab', 32);
set local role anon;
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(2, '10:00'))),
  'no error',
  'a cancelled appointment frees its slot'
);

-- "El primero disponible" -----------------------------------------------------------------------------

-- Day 3: B1 has one appointment at 08:00, B2 none. At 11:00 both are free:
-- B2 wins with fewer appointments that day.
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(3, '08:00'))),
  'no error',
  'B1 takes an appointment on day 3'
);
select is(
  (select r.barber_id from public.book_appointment(
     p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000000001', p_barber_id => null, p_starts_at => pg_temp.at(3, '11:00'),
     p_service_ids => array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[],
     p_customer_name => 'Ana', p_customer_email => 'ana@example.com', p_customer_phone => null,
     p_manage_token_hash => encode(sha256('first-1'::bytea), 'hex')) r),
  'ba000000-0000-0000-0000-000000000002'::uuid,
  '"el primero disponible" picks the barber with fewer appointments that day'
);
-- Day 4: nobody has appointments; Corte + Barba leaves out B4 (only Corte)
-- and B3 (inactive): B1 wins by sort order.
select is(
  (select r.barber_id from public.book_appointment(
     p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000000001', p_barber_id => null, p_starts_at => pg_temp.at(4, '11:00'),
     p_service_ids => array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[],
     p_customer_name => 'Ana', p_customer_email => 'ana@example.com', p_customer_phone => null,
     p_manage_token_hash => encode(sha256('first-2'::bytea), 'hex')) r),
  'ba000000-0000-0000-0000-000000000001'::uuid,
  'ties go to the lower sort order'
);
select is(
  (select r.barber_id from public.book_appointment(
     p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000000001', p_barber_id => null, p_starts_at => pg_temp.at(4, '11:00'),
     p_service_ids => array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[],
     p_customer_name => 'Ana', p_customer_email => 'ana@example.com', p_customer_phone => null,
     p_manage_token_hash => encode(sha256('first-3'::bytea), 'hex')) r),
  'ba000000-0000-0000-0000-000000000002'::uuid,
  'the next one at the same time goes to the next free barber'
);
select is(
  pg_temp.hint_of(pg_temp.book(null, pg_temp.at(4, '11:00'),
    services => array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[])),
  'slot_taken',
  'B4 does not do Barba, so nobody is left'
);

-- Barbers and services ------------------------------------------------------------------------------

select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000003', pg_temp.at(5, '10:00'))),
  'barber_unavailable',
  'an inactive barber takes no booking'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000004', pg_temp.at(5, '10:00'),
    services => array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[])),
  'barber_unavailable',
  'a barber who does not offer every service takes no booking'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-0000000000b1', pg_temp.at(5, '10:00'))),
  'barber_unavailable',
  'a barber of another barbershop takes no booking'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '10:00'),
    services => array['5e000000-0000-0000-0000-000000000003']::uuid[])),
  'service_inactive',
  'an inactive service is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '10:00'),
    services => array['5e000000-0000-0000-0000-0000000000b1']::uuid[])),
  'service_inactive',
  'a service of another barbershop is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '10:00'),
    services => array[]::uuid[])),
  'services_required',
  'no service is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '10:00'),
    services => array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002',
                      '5e000000-0000-0000-0000-000000000004', '5e000000-0000-0000-0000-000000000005',
                      '5e000000-0000-0000-0000-000000000006', '5e000000-0000-0000-0000-000000000003']::uuid[])),
  'services_required',
  'more than 5 services are refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '10:00'),
    services => array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001']::uuid[])),
  'services_repeated',
  'a repeated service is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '10:00'),
    services => array['5e000000-0000-0000-0000-000000000001', null]::uuid[])),
  'services_required',
  'a null service is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '07:00'),
    services => array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000004',
                      '5e000000-0000-0000-0000-000000000005']::uuid[])),
  'booking_too_long',
  'more than 480 minutes is refused'
);

-- The rules of the engine, enforced in SQL ------------------------------------------------------------

select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '10:05'))),
  'slot_invalid',
  'a start off the quarter hours is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '10:00') + interval '1 second')),
  'slot_invalid',
  'a start with seconds is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(-1, '10:00'))),
  'outside_booking_window',
  'yesterday is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(31, '10:00'))),
  'outside_booking_window',
  'today + 31 is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(30, '10:00'))),
  'no error',
  'today + 30 is the last day (both ends included)'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001',
    to_timestamp(ceil(extract(epoch from now()) / 900) * 900) + interval '15 minutes')),
  'booking_notice',
  'a start within the minimum notice is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '05:00'))),
  'outside_hours',
  'a start before opening is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '21:45'))),
  'outside_hours',
  'an appointment that ends after closing is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(5, '21:30'))),
  'no error',
  'one that ends right at closing is booked'
);
reset role;
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', pg_temp.at(6, '10:00'), pg_temp.at(6, '11:00'), 'Médico'),
  ('aaaaaaaa-0000-0000-0000-000000000001', null, pg_temp.at(7, '14:00'), pg_temp.at(8, '00:00'), 'Cierre');
set local role anon;
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(6, '10:30'))),
  'blocked',
  'a block of the barber is refused'
);
select is(
  (select r.barber_id from public.book_appointment(
     p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000000001', p_barber_id => null, p_starts_at => pg_temp.at(6, '10:30'),
     p_service_ids => array['5e000000-0000-0000-0000-000000000001']::uuid[],
     p_customer_name => 'Ana', p_customer_email => 'ana@example.com', p_customer_phone => null,
     p_manage_token_hash => encode(sha256('blocked-1'::bytea), 'hex')) r),
  'ba000000-0000-0000-0000-000000000002'::uuid,
  '"el primero disponible" skips the blocked barber'
);
select is(
  pg_temp.hint_of(pg_temp.book(null, pg_temp.at(7, '15:00'))),
  'slot_taken',
  'a closure of the whole barbershop leaves nobody free'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000002', pg_temp.at(7, '13:45'))),
  'blocked',
  'an appointment that runs into the closure is refused'
);

-- Untrusted input -------------------------------------------------------------------------------------

select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), customer_name => '   ')),
  'customer_name_invalid', 'a blank name is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), customer_name => repeat('a', 101))),
  'customer_name_invalid', 'a name of 101 characters is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), customer_name => E'Ana
Bcc: x@y.co')),
  'customer_name_invalid', 'a name with control characters is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), customer_email => 'no-es-correo')),
  'customer_email_invalid', 'an invalid email is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), customer_email => null)),
  'customer_email_invalid', 'a missing email is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), customer_phone => '+15551234567')),
  'customer_phone_invalid', 'a phone that is not a Colombian mobile is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), customer_phone => '3001234567')),
  'customer_phone_invalid', 'a phone that is not E.164 is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), token_hash => 'token-en-claro')),
  'token_invalid', 'something that is not a SHA-256 hex digest is refused as the token'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), token_hash => repeat('ab', 32))),
  'token_invalid', 'a token hash already used is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', null)),
  'slot_invalid', 'a missing start is refused'
);
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000001', pg_temp.at(9, '10:00'), shop => null)),
  'slot_invalid', 'a missing barbershop is refused'
);

-- Barbershops that take no bookings -------------------------------------------------------------------

select is(
  pg_temp.hint_of(pg_temp.book(null, pg_temp.at(9, '10:00'), shop => 'dddddddd-0000-0000-0000-000000000001')),
  'not_accepting', 'a suspended barbershop: not_accepting'
);
select is(
  pg_temp.hint_of(pg_temp.book(null, pg_temp.at(9, '10:00'), shop => 'dddddddd-0000-0000-0000-000000000005')),
  'not_accepting', 'a deleted barbershop: not_accepting'
);
select is(
  pg_temp.hint_of(pg_temp.book(null, pg_temp.at(9, '10:00'), shop => '99999999-0000-0000-0000-000000000000')),
  'not_accepting', 'an unknown barbershop: not_accepting'
);

-- What anon can read --------------------------------------------------------------------------------

select throws_ok('select id from public.appointments limit 1', '42501', null, 'anon still reads no appointment after booking');
select throws_ok('select id from public.customers limit 1', '42501', null, 'nor any customer');
select throws_ok('select 1 from public.appointment_services limit 1', '42501', null, 'nor any appointment line');

select ok(
  (select count(*) > 0 and bool_and(r.barber_id is not null and r.starts_at < r.ends_at)
   from public.booking_busy_ranges('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.at(0, '00:00'), pg_temp.at(30, '00:00')) r),
  'booking_busy_ranges gives the ranges of the barbershop'
);
select is(
  (select count(*)::int
   from public.booking_busy_ranges('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.at(2, '00:00'), pg_temp.at(3, '00:00')) r
   where r.barber_id = 'ba000000-0000-0000-0000-000000000001'),
  2,
  'only the appointments that take the time (10:00 and 10:30; the cancelled one is left out)'
);
select is(
  pg_temp.hint_of($$select * from public.booking_busy_ranges('aaaaaaaa-0000-0000-0000-000000000001', now(), now() + interval '33 days')$$),
  'range_invalid', 'more than 32 days at once is refused'
);
select is(
  pg_temp.hint_of($$select * from public.booking_busy_ranges('aaaaaaaa-0000-0000-0000-000000000001', now(), now() - interval '1 day')$$),
  'range_invalid', 'a range that ends before it starts is refused'
);
select is(
  pg_temp.hint_of($$select * from public.booking_busy_ranges('aaaaaaaa-0000-0000-0000-000000000001', now() - interval '40 days', now() - interval '10 days')$$),
  'range_invalid', 'the past of a barbershop is refused'
);
select is(
  pg_temp.hint_of($$select * from public.booking_busy_ranges('aaaaaaaa-0000-0000-0000-000000000001', now() + interval '10 days', now() + interval '40 days')$$),
  'range_invalid', 'and so is what lies after the booking window'
);
select is(
  pg_temp.hint_of($$select * from public.booking_busy_ranges('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.at(0, '00:00'), pg_temp.at(31, '00:00'))$$),
  'no error', 'today 00:00 to the end of today + 30 (what the app asks) is allowed'
);
select is_empty(
  $$select * from public.booking_busy_ranges('dddddddd-0000-0000-0000-000000000001', now(), now() + interval '30 days')$$,
  'a barbershop that takes no bookings shows no ranges'
);
reset role;
update public.barbers set active = false where id = 'ba000000-0000-0000-0000-000000000004';
set local role anon;
select is(
  (select count(*)::int
   from public.booking_busy_ranges('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.at(0, '00:00'), pg_temp.at(30, '00:00')) r
   where r.barber_id = 'ba000000-0000-0000-0000-000000000004'),
  0,
  'nor the appointments of an inactive barber'
);

-- Another barbershop's owner ------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(
  pg_temp.hint_of(pg_temp.book('ba000000-0000-0000-0000-000000000002', pg_temp.at(9, '10:00'), customer_email => 'duenio-o@example.com')),
  'no error',
  'a signed-in owner of another barbershop books like anyone (source web)'
);
select is(
  (select count(*)::int from public.appointments where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0,
  'but reads none of the appointments of S'
);
select is(
  (select count(*)::int from public.customers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0,
  'nor its customers'
);
select throws_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
    'ba000000-0000-0000-0000-000000000001', now() + interval '3 days', array['5e000000-0000-0000-0000-000000000001']::uuid[], 'web', repeat('ef', 32))$$,
  '42501', null,
  'and cannot create a web appointment through create_appointment'
);
reset role;
select is(
  (select a.source from public.appointments a
   join public.customers c on c.id = a.customer_id
   where c.email = 'duenio-o@example.com'),
  'web'::public.appointment_source,
  'that booking is a web booking of S'
);

-- The engine cases ------------------------------------------------------------------------------------
-- The fixture and the cases between the markers are JSON that
-- booking-rules.sql.test.ts reads and runs through availableSlots. A case
-- is free in SQL when booking_time_problem and barber_slot_problem are both
-- null; it must be free in the engine exactly when "ok" is true.
-- now: Monday 2026-11-09 08:00 Bogotá. 2026-11-16 is a holiday (closed) and
-- 2026-12-08 is one the barbershop opens.

create function pg_temp.engine_fixture()
returns text
language sql
immutable
as $fixture$ select $json$
-- engine-fixture:begin
{
  "now": "2026-11-09T13:00:00Z",
  "minNoticeMinutes": 60,
  "shopHours": [
    { "weekday": 1, "start": "09:00", "end": "13:00" }, { "weekday": 1, "start": "14:00", "end": "19:00" },
    { "weekday": 2, "start": "09:00", "end": "13:00" }, { "weekday": 2, "start": "14:00", "end": "19:00" },
    { "weekday": 3, "start": "09:00", "end": "13:00" }, { "weekday": 3, "start": "14:00", "end": "19:00" },
    { "weekday": 4, "start": "09:00", "end": "13:00" }, { "weekday": 4, "start": "14:00", "end": "19:00" },
    { "weekday": 5, "start": "09:00", "end": "13:00" }, { "weekday": 5, "start": "14:00", "end": "19:00" },
    { "weekday": 6, "start": "09:00", "end": "13:00" }, { "weekday": 6, "start": "13:00", "end": "17:00" }
  ],
  "holidayOpenings": ["2026-12-08"],
  "barbers": [
    { "id": "e0000000-0000-0000-0000-0000000000a1", "sortOrder": 1, "usesBarbershopHours": true, "shifts": [] },
    { "id": "e0000000-0000-0000-0000-0000000000b2", "sortOrder": 2, "usesBarbershopHours": false, "shifts": [
      { "weekday": 1, "start": "08:00", "end": "11:00" }, { "weekday": 1, "start": "15:00", "end": "24:00" },
      { "weekday": 2, "start": "10:00", "end": "12:00" }
    ] }
  ],
  "blocks": [
    { "barberId": null, "start": "2026-11-13T19:00:00Z", "end": "2026-11-14T05:00:00Z" },
    { "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-10T15:00:00Z", "end": "2026-11-10T16:00:00Z" }
  ],
  "appointments": [
    { "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-11T15:00:00Z", "end": "2026-11-11T15:40:00Z" }
  ],
  "cases": [
    { "label": "the notice edge, 09:00 at 08:00 with 60 minutes", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-09T14:00:00Z", "minutes": 30, "ok": true },
    { "label": "before opening and inside the notice", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-09T13:45:00Z", "minutes": 30, "ok": false },
    { "label": "crosses the lunch break", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-09T17:45:00Z", "minutes": 30, "ok": false },
    { "label": "ends right at the lunch break", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-09T17:30:00Z", "minutes": 30, "ok": true },
    { "label": "off the quarter hours", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-09T14:10:00Z", "minutes": 30, "ok": false },
    { "label": "own hours cut by the barbershop's", "barberId": "e0000000-0000-0000-0000-0000000000b2", "start": "2026-11-09T15:30:00Z", "minutes": 30, "ok": true },
    { "label": "after the barber's own shift", "barberId": "e0000000-0000-0000-0000-0000000000b2", "start": "2026-11-09T16:00:00Z", "minutes": 30, "ok": false },
    { "label": "own shift until midnight cut at closing, inside", "barberId": "e0000000-0000-0000-0000-0000000000b2", "start": "2026-11-09T23:30:00Z", "minutes": 30, "ok": true },
    { "label": "own shift until midnight cut at closing, past it", "barberId": "e0000000-0000-0000-0000-0000000000b2", "start": "2026-11-09T23:45:00Z", "minutes": 30, "ok": false },
    { "label": "shifts that touch are joined", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-14T17:45:00Z", "minutes": 30, "ok": true },
    { "label": "closed on Sunday", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-15T15:00:00Z", "minutes": 30, "ok": false },
    { "label": "a holiday the barbershop does not open", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-16T15:00:00Z", "minutes": 30, "ok": false },
    { "label": "a holiday the barbershop opens", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-12-08T15:00:00Z", "minutes": 30, "ok": true },
    { "label": "a holiday opened, with the barber's own Tuesday hours", "barberId": "e0000000-0000-0000-0000-0000000000b2", "start": "2026-12-08T15:30:00Z", "minutes": 30, "ok": true },
    { "label": "inside the barber's block", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-10T15:30:00Z", "minutes": 30, "ok": false },
    { "label": "right after the block", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-10T16:00:00Z", "minutes": 30, "ok": true },
    { "label": "ends right at the block", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-10T14:30:00Z", "minutes": 30, "ok": true },
    { "label": "another barber's block does not count", "barberId": "e0000000-0000-0000-0000-0000000000b2", "start": "2026-11-10T15:30:00Z", "minutes": 30, "ok": true },
    { "label": "the closure of the whole barbershop", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-13T19:00:00Z", "minutes": 30, "ok": false },
    { "label": "before the closure", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-13T17:30:00Z", "minutes": 30, "ok": true },
    { "label": "on another appointment", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-11T15:00:00Z", "minutes": 30, "ok": false },
    { "label": "overlapping the end of another appointment", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-11T15:30:00Z", "minutes": 30, "ok": false },
    { "label": "after another appointment", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-11T15:45:00Z", "minutes": 30, "ok": true },
    { "label": "ends right when another appointment starts", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-11T14:30:00Z", "minutes": 30, "ok": true },
    { "label": "the last day of the window", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-12-09T15:00:00Z", "minutes": 30, "ok": true },
    { "label": "the day after the window", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-12-10T15:00:00Z", "minutes": 30, "ok": false },
    { "label": "a long service that fits the afternoon", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-09T19:00:00Z", "minutes": 240, "ok": true },
    { "label": "a long service that does not fit", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-09T19:15:00Z", "minutes": 300, "ok": false },
    { "label": "a barber who does not work that day", "barberId": "e0000000-0000-0000-0000-0000000000b2", "start": "2026-11-13T15:00:00Z", "minutes": 30, "ok": false },
    { "label": "in the past", "barberId": "e0000000-0000-0000-0000-0000000000a1", "start": "2026-11-06T15:00:00Z", "minutes": 30, "ok": false }
  ]
}
-- engine-fixture:end
$json$::text $fixture$;

-- The SQL comments around the JSON are not JSON: cut them off.
create function pg_temp.fixture()
returns jsonb
language sql
as $$
  select substring(pg_temp.engine_fixture() from '\{.*\}')::jsonb
$$;

-- Barbershop E holds the fixture (as the table owner).
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on, min_booking_notice_minutes) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Barbería E', 'barberia-e',
   private.today_bogota() + 10, private.today_bogota() + 10, (pg_temp.fixture() ->> 'minNoticeMinutes')::int);
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select 'eeeeeeee-0000-0000-0000-000000000001', (h ->> 'weekday')::smallint, (h ->> 'start')::time, (h ->> 'end')::time
from jsonb_array_elements(pg_temp.fixture() -> 'shopHours') h;
insert into public.holiday_openings (barbershop_id, holiday_date)
select 'eeeeeeee-0000-0000-0000-000000000001', d::date
from jsonb_array_elements_text(pg_temp.fixture() -> 'holidayOpenings') d;
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, uses_barbershop_hours)
select (b ->> 'id')::uuid, 'eeeeeeee-0000-0000-0000-000000000001', 'Barbero ' || (b ->> 'sortOrder'),
  encode(sha256(convert_to(b ->> 'id', 'UTF8')), 'hex'), (b ->> 'sortOrder')::int, (b ->> 'usesBarbershopHours')::boolean
from jsonb_array_elements(pg_temp.fixture() -> 'barbers') b;
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
select 'eeeeeeee-0000-0000-0000-000000000001', (b ->> 'id')::uuid, (s ->> 'weekday')::smallint, (s ->> 'start')::time, (s ->> 'end')::time
from jsonb_array_elements(pg_temp.fixture() -> 'barbers') b, jsonb_array_elements(b -> 'shifts') s;
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at)
select 'eeeeeeee-0000-0000-0000-000000000001', (k ->> 'barberId')::uuid, (k ->> 'start')::timestamptz, (k ->> 'end')::timestamptz
from jsonb_array_elements(pg_temp.fixture() -> 'blocks') k;
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('5e000000-0000-0000-0000-0000000000e1', 'eeeeeeee-0000-0000-0000-000000000001', 'Corte', 25000, 40);
insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-0000000000e1', 'eeeeeeee-0000-0000-0000-000000000001', 'Cliente E', 'cliente-e@example.com');
insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
select 'eeeeeeee-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000e1', (a ->> 'barberId')::uuid,
  (a ->> 'start')::timestamptz, (a ->> 'end')::timestamptz, 25000, 'manual'
from jsonb_array_elements(pg_temp.fixture() -> 'appointments') a;

select is(
  (select jsonb_array_length(pg_temp.fixture() -> 'cases')),
  30,
  'the fixture has its 30 cases'
);
select is(
  (select coalesce(string_agg(c ->> 'label', '; '), 'none')
   from jsonb_array_elements(pg_temp.fixture() -> 'cases') c
   where (
     private.booking_time_problem('eeeeeeee-0000-0000-0000-000000000001', (c ->> 'start')::timestamptz,
       (c ->> 'minutes')::int, (pg_temp.fixture() ->> 'now')::timestamptz) is null
     and private.barber_slot_problem('eeeeeeee-0000-0000-0000-000000000001', (c ->> 'barberId')::uuid,
       (c ->> 'start')::timestamptz, (c ->> 'start')::timestamptz + make_interval(mins => (c ->> 'minutes')::int)) is null
   ) is distinct from (c ->> 'ok')::boolean),
  'none',
  'SQL agrees with every case of the engine'
);
select is(
  private.booking_time_problem('eeeeeeee-0000-0000-0000-000000000001', '2026-11-16T15:00:00Z', 30, '2026-11-09T13:00:00Z'),
  'closed', 'a closed holiday says closed'
);
select is(
  private.booking_time_problem('eeeeeeee-0000-0000-0000-000000000001', '2026-11-09T13:45:00Z', 30, '2026-11-09T13:00:00Z'),
  'booking_notice', 'inside the notice says booking_notice'
);
select is(
  private.booking_time_problem('eeeeeeee-0000-0000-0000-000000000001', '2026-11-10T15:00:00Z', 4, '2026-11-09T13:00:00Z'),
  'slot_invalid', 'less than 5 minutes is invalid'
);
-- 23:30 Bogotá on December 9 is 04:30Z of December 10: the day is Bogotá's.
select is(
  private.booking_time_problem('eeeeeeee-0000-0000-0000-000000000001', '2026-12-10T04:30:00Z', 30, '2026-11-09T13:00:00Z'),
  null, 'the window counts Bogotá days, not UTC days'
);
select results_eq(
  $$select starts_at, ends_at from private.barber_open_spans('eeeeeeee-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000b2', '2026-11-09')$$,
  $$values ('2026-11-09T14:00:00Z'::timestamptz, '2026-11-09T16:00:00Z'::timestamptz),
           ('2026-11-09T20:00:00Z'::timestamptz, '2026-11-10T00:00:00Z'::timestamptz)$$,
  'the own hours of a barber are cut to the hours of the barbershop'
);
select results_eq(
  $$select starts_at, ends_at from private.barber_open_spans('eeeeeeee-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', '2026-11-14')$$,
  $$values ('2026-11-14T14:00:00Z'::timestamptz, '2026-11-14T22:00:00Z'::timestamptz)$$,
  'shifts that touch are one span'
);

-- Colombian holidays -------------------------------------------------------------------------------
-- festivos.sql.test.ts compares the list between the markers with
-- getColombianHolidays.

select is(
  (select array_agg(h::text order by h)
   from generate_series(2024, 2032) y, private.colombian_holidays(y) h),
  -- holidays:begin
  array[
    '2024-01-01', '2024-01-08', '2024-03-25', '2024-03-28', '2024-03-29', '2024-05-01', '2024-05-13', '2024-06-03', '2024-06-10', '2024-07-01', '2024-07-20', '2024-08-07', '2024-08-19', '2024-10-14', '2024-11-04', '2024-11-11', '2024-12-08', '2024-12-25',
    '2025-01-01', '2025-01-06', '2025-03-24', '2025-04-17', '2025-04-18', '2025-05-01', '2025-06-02', '2025-06-23', '2025-06-30', '2025-07-20', '2025-08-07', '2025-08-18', '2025-10-13', '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25',
    '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-13', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25',
    '2027-01-01', '2027-01-11', '2027-03-22', '2027-03-25', '2027-03-26', '2027-05-01', '2027-05-10', '2027-05-31', '2027-06-07', '2027-07-05', '2027-07-12', '2027-07-20', '2027-08-07', '2027-08-16', '2027-10-18', '2027-11-01', '2027-11-15', '2027-12-08', '2027-12-25',
    '2028-01-01', '2028-01-10', '2028-03-20', '2028-04-13', '2028-04-14', '2028-05-01', '2028-05-29', '2028-06-19', '2028-06-26', '2028-07-03', '2028-07-10', '2028-07-20', '2028-08-07', '2028-08-21', '2028-10-16', '2028-11-06', '2028-11-13', '2028-12-08', '2028-12-25',
    '2029-01-01', '2029-01-08', '2029-03-19', '2029-03-29', '2029-03-30', '2029-05-01', '2029-05-14', '2029-06-04', '2029-06-11', '2029-07-02', '2029-07-09', '2029-07-20', '2029-08-07', '2029-08-20', '2029-10-15', '2029-11-05', '2029-11-12', '2029-12-08', '2029-12-25',
    '2030-01-01', '2030-01-07', '2030-03-25', '2030-04-18', '2030-04-19', '2030-05-01', '2030-06-03', '2030-06-24', '2030-07-01', '2030-07-15', '2030-07-20', '2030-08-07', '2030-08-19', '2030-10-14', '2030-11-04', '2030-11-11', '2030-12-08', '2030-12-25',
    '2031-01-01', '2031-01-06', '2031-03-24', '2031-04-10', '2031-04-11', '2031-05-01', '2031-05-26', '2031-06-16', '2031-06-23', '2031-06-30', '2031-07-14', '2031-07-20', '2031-08-07', '2031-08-18', '2031-10-13', '2031-11-03', '2031-11-17', '2031-12-08', '2031-12-25',
    '2032-01-01', '2032-01-12', '2032-03-22', '2032-03-25', '2032-03-26', '2032-05-01', '2032-05-10', '2032-05-31', '2032-06-07', '2032-07-05', '2032-07-12', '2032-07-20', '2032-08-07', '2032-08-16', '2032-10-18', '2032-11-01', '2032-11-15', '2032-12-08', '2032-12-25'
  ],
  -- holidays:end
  'the holidays of SQL are the ones of festivos.ts, 2024 to 2032'
);
select ok(
  private.is_colombian_holiday('2027-03-22') and not private.is_colombian_holiday('2027-03-19'),
  'San José 2027 moves from Friday to Monday'
);
select is(private.booking_window_days(), 30, 'the window is BOOKING_WINDOW_DAYS days');

select * from finish();
rollback;
