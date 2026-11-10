-- Migration add_quarter_hour_checks: the barbershop's hours and each
-- barber's own hours are kept to quarter hours, whoever writes them.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, uses_barbershop_hours) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Ana', repeat('a', 64), false);

-- The barbershop's hours ---------------------------------------------------------------

select lives_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 1, '09:15', '20:45')$$,
  'quarter hours go in'
);
select throws_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 2, '09:07', '18:00')$$,
  '23514', null, 'a start off the quarter hour is refused'
);
select throws_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 2, '09:00', '18:07')$$,
  '23514', null, 'so is an end off the quarter hour'
);
select throws_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 2, '09:00:30', '18:00')$$,
  '23514', null, 'and a time with seconds'
);
select throws_ok(
  $$update public.barbershop_hours set end_time = '20:45:00.5'
    where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23514', null, 'or with a fraction of a second, also on update'
);

-- A barber's own hours ----------------------------------------------------------------------

select lives_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 1, '09:30', '12:45')$$,
  'quarter hours go in for a barber too'
);
select throws_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 2, '09:07', '12:00')$$,
  '23514', null, 'a barber''s start off the quarter hour is refused'
);
select throws_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 2, '09:00', '12:00:30')$$,
  '23514', null, 'and a barber''s end with seconds'
);

-- Through the owner's function too -------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com');
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      '[{"weekday": 1, "start": "09:07", "end": "18:00"}]')$$,
  '23514', null, 'set_barbershop_hours refuses 09:07'
);
select throws_ok(
  $$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000000',
      '[{"weekday": 1, "start": "09:00:30", "end": "18:00"}]')$$,
  '23514', null, 'and 09:00:30'
);

reset role;
select is(
  array(
    select left(start_time::text, 5) || '-' || left(end_time::text, 5)
    from public.barbershop_hours
    where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'
  ),
  array['09:15-20:45'],
  'the hours before stay as they were'
);

select * from finish();
rollback;
