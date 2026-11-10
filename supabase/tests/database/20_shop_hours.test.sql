-- Task 2.4a, migration add_barbershop_hours_editing: the owner replaces the
-- barbershop's week in one step (D-58), only in their own barbershop.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

select has_function('public', 'set_barbershop_hours', array['uuid', 'jsonb'], 'set_barbershop_hours exists');
select is(
  (select prosecdef from pg_proc where oid = 'public.set_barbershop_hours(uuid, jsonb)'::regprocedure),
  false, 'it runs as the caller, under RLS'
);

-- Fixtures -------------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'nobody@example.com');
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Sede B', 'sede-b', current_date + 10, current_date + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233'),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244'),
  ('00000000-0000-0000-0000-00000000000c', 'Sin barbería', '+573001112255');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, uses_barbershop_hours) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Ana', repeat('a', 64), false);
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 1, '09:00', '20:00'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 2, '09:00', '20:00'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 1, '10:00', '19:00');
-- Ana works Monday mornings, inside the hours before the change.
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 1, '09:00', '12:00');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- The owner replaces the whole week ---------------------------------------------------------

select lives_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      '[{"weekday": 3, "start": "10:00", "end": "13:00"},
        {"weekday": 3, "start": "14:00", "end": "19:00"},
        {"weekday": 6, "start": "08:00", "end": "21:00"}]')$$,
  'the owner saves a new week'
);
select is(
  array(
    select weekday || ' ' || left(start_time::text, 5) || '-' || left(end_time::text, 5)
    from public.barbershop_hours
    where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'
    order by weekday, start_time
  ),
  array['3 10:00-13:00', '3 14:00-19:00', '6 08:00-21:00'],
  'the week before is replaced whole, split shifts included'
);

-- Its rules ------------------------------------------------------------------------------------

select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000', '[]')$$,
  '23514', 'opening hours required', 'a barbershop closed every day is refused'
);
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000', null)$$,
  '23514', 'opening hours required', 'so is no week at all'
);
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      (select jsonb_agg(jsonb_build_object(
         'weekday', d % 7,
         'start', lpad((d / 7)::text, 2, '0') || ':00',
         'end', lpad((d / 7)::text, 2, '0') || ':30'))
       from generate_series(0, 14) d))$$,
  '23514', 'at most 14 shifts of weekday, start and end', 'more than 14 shifts are refused'
);
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      '[{"weekday": 1, "start": "09:00"}]')$$,
  '23514', 'at most 14 shifts of weekday, start and end', 'a shift without its end is refused'
);
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      '[{"weekday": 1, "start": "09:00", "end": "13:00"},
        {"weekday": 1, "start": "12:00", "end": "18:00"}]')$$,
  '23P01', null, 'shifts that overlap fail'
);
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      '[{"weekday": 1, "start": "18:00", "end": "09:00"}]')$$,
  '23514', null, 'a shift that ends before it starts fails'
);
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      '[{"weekday": 7, "start": "09:00", "end": "18:00"}]')$$,
  '23514', null, 'a weekday out of 0 to 6 fails'
);
select is(
  (select count(*)::int from public.barbershop_hours where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  3, 'and after each failure the hours before stay as they were'
);
select is(
  (select count(*)::int from public.barber_schedules where barber_id = 'a1000000-0000-0000-0000-000000000000'),
  1, 'barbers keep their own hours, even outside the new week'
);

-- Only in the owner's barbershop ---------------------------------------------------------------

select throws_ok(
  $$select public.set_barbershop_hours('bbbbbbbb-0000-0000-0000-000000000000',
      '[{"weekday": 1, "start": "06:00", "end": "07:00"}]')$$,
  '42501', null, 'an owner cannot change the hours of another barbershop'
);
select throws_ok(
  $$select public.set_barbershop_hours(null, '[{"weekday": 1, "start": "06:00", "end": "07:00"}]')$$,
  '42501', null, 'nor of no barbershop'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      '[{"weekday": 1, "start": "06:00", "end": "07:00"}]')$$,
  '42501', null, 'a session without a barbershop cannot change any'
);

-- Anonymous visitors cannot run it --------------------------------------------------------------

reset role;
set local role anon;
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      '[{"weekday": 1, "start": "06:00", "end": "07:00"}]')$$,
  '42501', null, 'anon cannot change hours'
);

reset role;
select is(
  array(
    select left(start_time::text, 5) || '-' || left(end_time::text, 5)
    from public.barbershop_hours
    where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'
  ),
  array['10:00-19:00'],
  'the other barbershop keeps its hours'
);
select is(
  (select count(*)::int from public.barbershop_hours where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  3, 'and so does the owner''s after the refused calls'
);

select * from finish();
rollback;
