-- Task 1.9, migration add_appointment_events (decision 0006): every change of
-- status, time or barber leaves a trace, written only by a trigger.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

select has_table('public', 'appointment_events', 'appointment_events exists');

-- Fixtures, inserted as the table owner -------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com');

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', current_date + 20),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Barbería B', 'barberia-b', current_date + 20);

insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A'),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B');

insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');

insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barbero A', repeat('a', 64)),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Barbero B', repeat('b', 64));

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte', 25000, 40),
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Corte', 25000, 40);

insert into public.customers (id, barbershop_id, full_name, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Cliente A', 'cliente-a@example.com'),
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Cliente B', 'cliente-b@example.com');

insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   'aaaaaaaa-0000-0000-0000-0000000000b1', now() + interval '1 day', now() + interval '1 day 40 minutes', 25000, 'web'),
  ('aaaaaaaa-0000-0000-0000-0000000000e2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   'aaaaaaaa-0000-0000-0000-0000000000b1', now() + interval '2 days', now() + interval '2 days 40 minutes', 25000, 'web'),
  ('aaaaaaaa-0000-0000-0000-0000000000e3', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   'aaaaaaaa-0000-0000-0000-0000000000b1', now() + interval '3 days', now() + interval '3 days 40 minutes', 25000, 'web'),
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000d1',
   'bbbbbbbb-0000-0000-0000-0000000000b1', now() + interval '1 day', now() + interval '1 day 40 minutes', 25000, 'web');

-- A signed-in owner is staff, with their account -----------------------------------------
-- Since task 4.2b the session changes appointments only through the security
-- definer functions of task 4.2: they write as their owner, with the caller's
-- claims, as these updates do.

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

update public.appointments set status = 'attended' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';

select results_eq(
  $$select type::text, actor::text, actor_user_id::text, old_status::text, new_status::text
    from public.appointment_events where appointment_id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$$,
  $$values ('status_changed', 'staff', '00000000-0000-0000-0000-00000000000a', 'confirmed', 'attended')$$,
  'a status change by an owner is logged as staff with their account'
);

-- A session cannot pose as a customer or a barber.
select set_config('yapoin.actor', 'customer', true);
update public.appointments
  set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour'
  where id = 'aaaaaaaa-0000-0000-0000-0000000000e2';
select set_config('yapoin.actor', '', true);

select results_eq(
  $$select type::text, actor::text, (new_starts_at - old_starts_at)::text
    from public.appointment_events where appointment_id = 'aaaaaaaa-0000-0000-0000-0000000000e2'$$,
  $$values ('rescheduled', 'staff', '01:00:00')$$,
  'a reschedule is logged with the old and new times, and a session stays staff'
);

set local role authenticated;

select throws_ok(
  $$insert into public.appointment_events (barbershop_id, appointment_id, type, actor)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'status_changed', 'customer')$$,
  '42501', null,
  'an owner cannot write events'
);
select throws_ok(
  $$update public.appointment_events set actor = 'system'$$,
  '42501', null,
  'an owner cannot edit events'
);
select throws_ok(
  $$delete from public.appointment_events$$,
  '42501', null,
  'an owner cannot delete events'
);

-- Another barbershop does not see them ------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty(
  $$select id from public.appointment_events where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'owner B does not see the events of barbershop A'
);

set local role anon;
set local request.jwt.claims to '';

select throws_ok(
  $$select id from public.appointment_events$$,
  '42501', null,
  'anon cannot read events'
);

-- Without a session: link functions set the actor, anything else is system ---------------

reset role;

select set_config('yapoin.actor', 'customer', true);
update public.appointments set status = 'cancelled_by_customer' where id = 'bbbbbbbb-0000-0000-0000-0000000000e1';
select set_config('yapoin.actor', 'barber', true);
update public.appointments set status = 'no_show' where id = 'aaaaaaaa-0000-0000-0000-0000000000e3';
select set_config('yapoin.actor', '', true);
update public.appointments set status = 'cancelled_by_barbershop' where id = 'aaaaaaaa-0000-0000-0000-0000000000e2';

select is(
  (select actor::text from public.appointment_events where appointment_id = 'bbbbbbbb-0000-0000-0000-0000000000e1'),
  'customer',
  'a change made through the customer link is logged as customer'
);
select is(
  (select actor_user_id from public.appointment_events where appointment_id = 'bbbbbbbb-0000-0000-0000-0000000000e1'),
  null,
  'with no account attached'
);
select is(
  (select actor::text from public.appointment_events where appointment_id = 'aaaaaaaa-0000-0000-0000-0000000000e3'),
  'barber',
  'a change made through the barber link is logged as barber'
);
select is(
  (select actor::text from public.appointment_events
   where appointment_id = 'aaaaaaaa-0000-0000-0000-0000000000e2' and type = 'status_changed'),
  'system',
  'a change without a session or an actor is logged as system'
);
select is(
  (select count(*)::int from public.appointment_events where appointment_id = 'aaaaaaaa-0000-0000-0000-0000000000e1'),
  1,
  'an update that changes nothing logged leaves no new event'
);

-- Owner A sees the history of their barbershop -----------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select count(*)::int from public.appointment_events where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  4,
  'owner A reads the whole history of barbershop A'
);
select is_empty(
  $$select id from public.appointment_events where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'and nothing of barbershop B'
);

select * from finish();
rollback;
