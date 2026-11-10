-- Task 1.9, migration prevent_overlapping_schedules (decision 0006): weekly
-- shifts of a barber, or of a barbershop, never overlap on the same weekday.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', current_date + 20),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Barbería B', 'barberia-b', current_date + 20);

insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barbero 1', repeat('a', 64)),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barbero 2', repeat('b', 64));

-- Barber schedules ---------------------------------------------------------------------

select lives_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 1, '08:00', '12:00'),
      ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 1, '12:00', '18:00')$$,
  'back-to-back shifts of a barber do not overlap'
);
select throws_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 1, '11:00', '13:00')$$,
  '23P01', null,
  'a barber shift that overlaps another on the same day fails'
);
select lives_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 2, '11:00', '13:00')$$,
  'the same hours on another day are fine'
);
select lives_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b2', 1, '11:00', '13:00')$$,
  'the same hours for another barber are fine'
);
select lives_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 1, '18:00', '24:00')$$,
  'a barber shift can run until midnight'
);
select throws_ok(
  $$update public.barber_schedules set start_time = '17:00'
    where barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b1' and weekday = 1 and start_time = '18:00'$$,
  '23P01', null,
  'moving a barber shift onto another fails too'
);

-- Barbershop hours ---------------------------------------------------------------------

select lives_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 1, '08:00', '12:00'),
      ('aaaaaaaa-0000-0000-0000-000000000000', 1, '12:00', '20:00')$$,
  'a split day of the barbershop does not overlap'
);
select throws_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 1, '10:00', '14:00')$$,
  '23P01', null,
  'barbershop hours that overlap on the same day fail'
);
select lives_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 2, '10:00', '14:00')$$,
  'the same hours on another day are fine'
);
select lives_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
      ('bbbbbbbb-0000-0000-0000-000000000000', 1, '10:00', '14:00')$$,
  'another barbershop has its own hours'
);
select lives_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 1, '20:00', '24:00')$$,
  'barbershop hours can run until midnight'
);
select is(
  (select count(*)::int from public.barbershop_hours where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000' and weekday = 1),
  3,
  'only the shifts that do not overlap were kept'
);

select * from finish();
rollback;
