-- Task 1.9, migration add_appointment_guards (decision 0006): web bookings carry
-- the customer's email, and an inactive barber's agenda is closed from now on
-- while his existing appointments stay manageable.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

-- Fixtures, inserted as the table owner -------------------------------------------

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', current_date + 20);

insert into public.barbers (id, barbershop_id, display_name, link_token_hash, active) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Activo', repeat('a', 64), true),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Se va', repeat('b', 64), true);

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte', 25000, 40);

insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000c1');

insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 1, '09:00', '18:00'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b2', 1, '09:00', '18:00');

insert into public.customers (id, barbershop_id, full_name, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Con correo', 'con-correo@example.com'),
  ('aaaaaaaa-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Sin correo', null);

-- Appointments and a block the leaving barber already had.
insert into public.appointments (id, barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   'aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000c1', now() + interval '1 day', now() + interval '1 day 40 minutes', 25000, 'web'),
  ('aaaaaaaa-0000-0000-0000-0000000000e2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   'aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000c1', now() + interval '2 days', now() + interval '2 days 40 minutes', 25000, 'web'),
  ('aaaaaaaa-0000-0000-0000-0000000000e3', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   'aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000c1', now() + interval '3 days', now() + interval '3 days 40 minutes', 25000, 'web'),
  ('aaaaaaaa-0000-0000-0000-0000000000e4', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1', now() + interval '4 days', now() + interval '4 days 40 minutes', 25000, 'web');

insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b2',
   now() + interval '5 days', now() + interval '5 days 1 hour', 'Permiso');

update public.barbers set active = false where id = 'aaaaaaaa-0000-0000-0000-0000000000b2';

-- Email on web bookings ------------------------------------------------------------

select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-0000000000b1',
            'aaaaaaaa-0000-0000-0000-0000000000c1', now() + interval '6 days', now() + interval '6 days 40 minutes', 25000, 'web')$$,
  '23514', 'web booking needs the customer email',
  'a web booking for a customer without email fails'
);
select lives_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-0000000000b1',
            'aaaaaaaa-0000-0000-0000-0000000000c1', now() + interval '7 days', now() + interval '7 days 40 minutes', 25000, 'manual')$$,
  'a manual appointment for a customer without email works'
);

-- The inactive barber's agenda is closed from now on -------------------------------------

select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000b2',
            'aaaaaaaa-0000-0000-0000-0000000000c1', now() + interval '8 days', now() + interval '8 days 40 minutes', 25000, 'manual')$$,
  '23514', 'barber is inactive',
  'a new appointment with an inactive barber fails'
);
select throws_ok(
  $$update public.appointments set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour'
    where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$$,
  '23514', 'barber is inactive',
  'moving an appointment of an inactive barber fails'
);
select throws_ok(
  $$update public.appointments set barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b2'
    where id = 'aaaaaaaa-0000-0000-0000-0000000000e4'$$,
  '23514', 'barber is inactive',
  'reassigning an appointment to an inactive barber fails'
);
select throws_ok(
  $$insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b2', now() + interval '9 days', now() + interval '9 days 1 hour', 'Nuevo')$$,
  '23514', 'barber is inactive',
  'a new block for an inactive barber fails'
);
select throws_ok(
  $$update public.time_blocks set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour'
    where id = 'aaaaaaaa-0000-0000-0000-0000000000f2'$$,
  '23514', 'barber is inactive',
  'moving a block of an inactive barber fails'
);
select lives_ok(
  $$insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
    values ('aaaaaaaa-0000-0000-0000-000000000000', null, now() + interval '9 days', now() + interval '9 days 1 hour', 'Cierre')$$,
  'a block for the whole barbershop is not affected'
);

-- His existing appointments stay manageable ---------------------------------------------

select lives_ok(
  $$update public.appointments set status = 'attended' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$$,
  'an appointment of an inactive barber can be marked attended'
);
select lives_ok(
  $$update public.appointments set status = 'cancelled_by_barbershop' where id = 'aaaaaaaa-0000-0000-0000-0000000000e2'$$,
  'an appointment of an inactive barber can be cancelled'
);
select lives_ok(
  $$update public.appointments set barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b1' where id = 'aaaaaaaa-0000-0000-0000-0000000000e3'$$,
  'an appointment of an inactive barber can be reassigned to an active one'
);
select lives_ok(
  $$delete from public.time_blocks where id = 'aaaaaaaa-0000-0000-0000-0000000000f2'$$,
  'a block of an inactive barber can be deleted'
);

-- The public page does not see an inactive barber ----------------------------------------

insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', now() + interval '10 days', now() + interval '10 days 1 hour', 'Almuerzo');

set local role anon;

select is_empty(
  $$select barber_id from public.barber_schedules where barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b2'$$,
  'anon does not see the schedule of an inactive barber'
);
select is_empty(
  $$select barber_id from public.barber_services where barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b2'$$,
  'anon does not see the services of an inactive barber'
);
select isnt_empty(
  $$select barber_id from public.barber_schedules where barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b1'$$,
  'anon still sees the schedule of an active barber'
);
select isnt_empty(
  $$select barber_id from public.barber_services where barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b1'$$,
  'anon still sees the services of an active barber'
);
select isnt_empty(
  $$select starts_at from public.time_blocks where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000' and barber_id is null$$,
  'anon still sees blocks of the whole barbershop'
);
select isnt_empty(
  $$select starts_at from public.time_blocks where barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b1'$$,
  'anon still sees blocks of an active barber'
);

select * from finish();
rollback;
