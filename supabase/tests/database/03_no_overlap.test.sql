-- Task 1.3: two active appointments of the same barber never overlap.
-- Active means it holds the slot: confirmed, attended or no_show.
-- Times are UTC; 15:00Z is 10:00 in Bogotá.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

-- Fixtures ----------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com');

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', '2026-11-18');

insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner');

insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barbero 1', repeat('a', 64)),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barbero 2', repeat('b', 64));

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte', 25000, 40);

insert into public.customers (id, barbershop_id, full_name, email, phone) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Cliente 1', 'cliente1@example.com', '+573001112233'),
  ('aaaaaaaa-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Cliente 2', 'cliente2@example.com', '+573004445566');

-- Barber 1 is booked 10:00-10:40 Bogotá.
insert into public.appointments (id, barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000b1',
   'aaaaaaaa-0000-0000-0000-0000000000c1', '2026-11-10 15:00Z', '2026-11-10 15:40Z', 25000, 'web');

-- Shorthand for "book barber $1 from $2 to $3 for customer 2".
create function pg_temp.book(barber uuid, starts timestamptz, ends timestamptz)
returns text
language sql
as $$
  select format(
    $f$insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source)
       values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d2', %L, 'aaaaaaaa-0000-0000-0000-0000000000c1', %L, %L, 25000, 'web')$f$,
    barber, starts, ends
  )
$$;

-- 1. The constraint exists ------------------------------------------------------

select is(
  (select count(*) from pg_constraint
   where conrelid = 'public.appointments'::regclass
     and conname = 'appointments_no_overlap'
     and contype = 'x'),
  1::bigint,
  'appointments have the no-overlap exclusion constraint'
);

-- 2. Overlaps are rejected --------------------------------------------------------

select throws_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 15:20Z', '2026-11-10 16:00Z'),
  '23P01', null, 'a partial overlap is rejected'
);
select throws_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 15:10Z', '2026-11-10 15:30Z'),
  '23P01', null, 'an appointment inside another is rejected'
);
select throws_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 14:50Z', '2026-11-10 16:00Z'),
  '23P01', null, 'an appointment around another is rejected'
);
select throws_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 15:00Z', '2026-11-10 15:40Z'),
  '23P01', null, 'the exact same slot is rejected'
);

-- 3. Back-to-back and other barbers are fine --------------------------------------

select lives_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 15:40Z', '2026-11-10 16:20Z'),
  'an appointment can start when the previous one ends'
);
select lives_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 14:20Z', '2026-11-10 15:00Z'),
  'an appointment can end when the next one starts'
);
select lives_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b2', '2026-11-10 15:00Z', '2026-11-10 15:40Z'),
  'another barber can take the same time'
);

-- 4. Cancelled appointments free their slot ---------------------------------------

insert into public.appointments (id, barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source, status) values
  ('aaaaaaaa-0000-0000-0000-0000000000e2', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000b2',
   'aaaaaaaa-0000-0000-0000-0000000000c1', '2026-11-10 17:00Z', '2026-11-10 17:40Z', 25000, 'web', 'cancelled_by_customer'),
  ('aaaaaaaa-0000-0000-0000-0000000000e3', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000b2',
   'aaaaaaaa-0000-0000-0000-0000000000c1', '2026-11-10 18:00Z', '2026-11-10 18:40Z', 25000, 'web', 'cancelled_by_barbershop');

select lives_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b2', '2026-11-10 17:00Z', '2026-11-10 17:40Z'),
  'a slot cancelled by the customer can be booked again'
);
select lives_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b2', '2026-11-10 18:00Z', '2026-11-10 18:40Z'),
  'a slot cancelled by the barbershop can be booked again'
);
select throws_ok(
  $$update public.appointments set status = 'confirmed' where id = 'aaaaaaaa-0000-0000-0000-0000000000e2'$$,
  '23P01', null,
  'a cancelled appointment cannot come back once its slot was taken'
);

-- 5. Attended and no-show keep holding their slot ---------------------------------

insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source, status) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1',
   '2026-11-10 19:00Z', '2026-11-10 19:40Z', 25000, 'web', 'attended'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1',
   '2026-11-10 20:00Z', '2026-11-10 20:40Z', 25000, 'web', 'no_show');

select throws_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 19:10Z', '2026-11-10 19:50Z'),
  '23P01', null, 'an attended appointment still holds its slot'
);
select throws_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 20:10Z', '2026-11-10 20:50Z'),
  '23P01', null, 'a no-show still holds its slot'
);

-- 6. Rescheduling follows the same rule -------------------------------------------

select throws_ok(
  $$update public.appointments set starts_at = '2026-11-10 15:30Z', ends_at = '2026-11-10 16:10Z'
    where barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b1' and starts_at = '2026-11-10 15:40Z'$$,
  '23P01', null,
  'an appointment cannot be moved onto another'
);

select lives_ok(
  $$update public.appointments set status = 'cancelled_by_barbershop' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$$,
  'cancelling an appointment works'
);
select lives_ok(
  pg_temp.book('aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 15:00Z', '2026-11-10 15:40Z'),
  'and its slot is free right away'
);

-- 7. The owner hits the same rule from the panel ----------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d2',
            'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1',
            '2026-11-10 19:20Z', '2026-11-10 20:00Z', 25000, 'manual')$$,
  '23P01', null,
  'a manual appointment from the panel cannot overlap either'
);

reset role;

select * from finish();
rollback;
