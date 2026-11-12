-- Task 4.1, the owner's agenda (D-30 to D-33). No migration: the panel
-- reads the agenda with the owner's session, straight from the tables, and
-- RLS keeps it inside the owner's barbershops. This proves both halves:
-- - the owner of A reads everything the agenda shows of A: barbers and
--   their hours, appointments with their customer and services, blocks;
-- - and nothing of barbershop B, in any of those tables, even naming it.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

-- Fixtures, inserted as the table owner -----------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com');
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'agenda-a', current_date + 10, current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Barbería B', 'agenda-b', current_date + 10, current_date + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233'),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select s, d, '06:00', '22:00'
from unnest(array['aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000']::uuid[]) s,
     generate_series(0, 6) d;
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('5e000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte A', 25000, 30),
  ('5e000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Corte B', 25000, 30);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, uses_barbershop_hours) values
  ('ba000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Mario', repeat('a', 64), false),
  ('ba000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Kevin', repeat('b', 64), false);
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'ba000000-0000-0000-0000-00000000000a', 1, '09:00', '18:00'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'ba000000-0000-0000-0000-00000000000b', 1, '09:00', '18:00');
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'ba000000-0000-0000-0000-00000000000a', '5e000000-0000-0000-0000-00000000000a'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'ba000000-0000-0000-0000-00000000000b', '5e000000-0000-0000-0000-00000000000b');
insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Luis García', 'luis@example.com'),
  ('c0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Pedro Suárez', 'pedro@example.com');
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'ba000000-0000-0000-0000-00000000000a',
   now() + interval '2 days', now() + interval '2 days 1 hour', 'Almuerzo'),
  ('bbbbbbbb-0000-0000-0000-000000000000', null,
   now() + interval '2 days', now() + interval '2 days 1 hour', 'Cierre B');

-- One appointment in each barbershop, written the way the panel and the
-- booking page write them.
select public.create_appointment(
  'aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a',
  'ba000000-0000-0000-0000-00000000000a', now() + interval '1 day',
  array['5e000000-0000-0000-0000-00000000000a']::uuid[], 'manual'
);
select public.create_appointment(
  'bbbbbbbb-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000b',
  'ba000000-0000-0000-0000-00000000000b', now() + interval '1 day',
  array['5e000000-0000-0000-0000-00000000000b']::uuid[], 'web', repeat('f', 64)
);

-- The owner of A ------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- What the agenda reads (src/modulos/agenda/datos/owner-agenda.ts).
select results_eq(
  $$select display_name, active, uses_barbershop_hours from public.barbers$$,
  $$values ('Mario'::text, true, false)$$,
  'the owner reads their barbers, with whether they use the barbershop''s hours'
);
select results_eq(
  $$select weekday, start_time from public.barber_schedules$$,
  $$values (1::smallint, '09:00'::time)$$,
  'and their own hours'
);
select is(
  (select count(*)::int from public.barbershop_hours),
  7,
  'and the barbershop''s hours, of A only'
);
select results_eq(
  $$select a.status::text, a.source::text, c.full_name, s.name
    from public.appointments a
    join public.customers c on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
    join public.appointment_services l on l.barbershop_id = a.barbershop_id and l.appointment_id = a.id
    join public.services s on s.barbershop_id = l.barbershop_id and s.id = l.service_id$$,
  $$values ('confirmed'::text, 'manual'::text, 'Luis García'::text, 'Corte A'::text)$$,
  'and their appointment, with its customer and its services'
);
select ok(
  (select bool_and(created_at is not null and starts_at < ends_at) from public.appointments),
  'with its start, end and when it was booked'
);
select results_eq(
  $$select reason, barber_id from public.time_blocks$$,
  $$values ('Almuerzo'::text, 'ba000000-0000-0000-0000-00000000000a'::uuid)$$,
  'and their blocks'
);
select is(
  (select count(*)::int from public.appointments where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  1,
  'hasAnyAppointment finds the first appointment of A'
);

-- Nothing of B, even asking for it by name.
select is_empty(
  $$select 1 from public.barbers where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'no barber of B'
);
select is_empty(
  $$select 1 from public.barber_schedules where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'no hours of a barber of B'
);
select is_empty(
  $$select 1 from public.barbershop_hours where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'no hours of B'
);
select is_empty(
  $$select 1 from public.appointments where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'no appointment of B'
);
select is_empty(
  $$select 1 from public.appointment_services where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'no service line of B'
);
select is_empty(
  $$select 1 from public.customers where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'no customer of B'
);
select is_empty(
  $$select 1 from public.time_blocks where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'no block or closure of B'
);
select is_empty(
  $$select 1 from public.services where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'no service of B'
);
select is_empty(
  $$select 1 from public.holiday_openings where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'no holiday opening of B'
);
select throws_ok(
  $$select manage_token_hash from public.appointments$$,
  '42501', null,
  'the agenda cannot read the hash of a manage link'
);

-- The owner of B sees the mirror image ----------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select results_eq(
  $$select c.full_name from public.appointments a
    join public.customers c on c.barbershop_id = a.barbershop_id and c.id = a.customer_id$$,
  $$values ('Pedro Suárez'::text)$$,
  'the owner of B reads only B''s appointment'
);
select results_eq(
  $$select reason, barber_id from public.time_blocks$$,
  $$values ('Cierre B'::text, null::uuid)$$,
  'and only B''s closure'
);
select is_empty(
  $$select 1 from public.appointments where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'
    union all
    select 1 from public.customers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'
    union all
    select 1 from public.time_blocks where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'and nothing of A'
);

-- Without a session ----------------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$select id from public.appointments$$,
  '42501', null,
  'anon reads no appointment'
);
select throws_ok(
  $$select full_name from public.customers$$,
  '42501', null,
  'and no customer'
);

select * from finish();
rollback;
