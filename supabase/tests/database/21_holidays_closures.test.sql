-- Task 2.4c, migration add_holiday_openings_editing: the owner opens the
-- holidays of the next 12 months in one step (D-59), only in their own
-- barbershop, and adds and removes closures of the whole barbershop.
-- Owners reading, writing or deleting another barbershop's openings and
-- blocks, and anon reading a block's reason, are covered in 02_rls.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

select has_function(
  'public', 'set_holiday_openings', array['uuid', 'date', 'date', 'date[]'],
  'set_holiday_openings exists'
);
select is(
  (select prosecdef from pg_proc
   where oid = 'public.set_holiday_openings(uuid, date, date, date[])'::regprocedure),
  false, 'it runs as the caller, under RLS'
);
select is(
  (select proconfig from pg_proc
   where oid = 'public.set_holiday_openings(uuid, date, date, date[])'::regprocedure),
  array['search_path=""'], 'it pins an empty search_path'
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
-- A opens two holidays inside the window of D-59 (2026-11-10 to 2027-11-09),
-- one before it and one after it. B opens Christmas.
insert into public.holiday_openings (barbershop_id, holiday_date) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '2026-11-02'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '2026-11-16'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '2026-12-08'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '2027-12-25'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '2026-12-25');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- The owner sets the holidays of the window ------------------------------------------------

select lives_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2026-11-10', '2027-11-09', '{2026-12-08, 2026-12-25, 2026-12-25}')$$,
  'the owner saves the holidays they open'
);
select is(
  array(
    select holiday_date::text from public.holiday_openings
    where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000' order by 1
  ),
  array['2026-11-02', '2026-12-08', '2026-12-25', '2027-12-25'],
  'inside the window, only those stay open (once); outside it nothing changes'
);
select lives_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2026-11-10', '2027-11-09', '{}')$$,
  'the owner closes every holiday of the window'
);
select is(
  array(
    select holiday_date::text from public.holiday_openings
    where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000' order by 1
  ),
  array['2026-11-02', '2027-12-25'],
  'and only the ones outside the window stay'
);
select lives_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2026-11-10', '2027-11-09', null)$$,
  'no dates at all reads as none'
);
select lives_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2026-11-10', '2027-11-09', '{2026-11-16}')$$,
  'the owner opens one again'
);

-- Its rules ------------------------------------------------------------------------------------

select throws_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2027-11-09', '2026-11-10', '{}')$$,
  '23514', 'a range of at most 401 days', 'a range that ends before it starts is refused'
);
select throws_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2026-01-01', '2027-03-01', '{}')$$,
  '23514', 'a range of at most 401 days', 'a range over 401 days is refused'
);
select throws_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      null, '2027-11-09', '{}')$$,
  '23514', 'a range of at most 401 days', 'a range without start is refused'
);
select throws_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2026-11-10', '2027-11-09', '{2026-12-25, 2027-12-25}')$$,
  '23514', 'dates inside the range', 'a date after the range is refused'
);
select throws_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2026-11-10', '2027-11-09', array['2026-12-25', null]::date[])$$,
  '23514', 'dates inside the range', 'a null date is refused'
);
select is(
  array(
    select holiday_date::text from public.holiday_openings
    where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000' order by 1
  ),
  array['2026-11-02', '2026-11-16', '2027-12-25'],
  'and after each failure the openings stay as they were'
);

-- Only in the owner's barbershop ---------------------------------------------------------------

select throws_ok(
  $$select public.set_holiday_openings('bbbbbbbb-0000-0000-0000-000000000000',
      '2026-11-10', '2027-11-09', '{}')$$,
  '42501', null, 'an owner cannot change the holidays of another barbershop'
);
select throws_ok(
  $$select public.set_holiday_openings(null, '2026-11-10', '2027-11-09', '{}')$$,
  '42501', null, 'nor of no barbershop'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2026-11-10', '2027-11-09', '{}')$$,
  '42501', null, 'a session without a barbershop cannot change any'
);

-- Closures of the whole barbershop (time_blocks without barber) --------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  $$insert into public.time_blocks (id, barbershop_id, starts_at, ends_at, reason)
    values ('aaaaaaaa-0000-0000-0000-0000000000f9', 'aaaaaaaa-0000-0000-0000-000000000000',
            '2026-12-24 19:00Z', '2026-12-25 05:00Z', 'Nochebuena')$$,
  'the owner closes the whole barbershop, with no barber'
);
select throws_ok(
  $$insert into public.time_blocks (barbershop_id, starts_at, ends_at)
    values ('aaaaaaaa-0000-0000-0000-000000000000', '2026-12-24 19:00Z', '2026-12-24 19:00Z')$$,
  '23514', null, 'a closure that does not end after it starts fails'
);
select throws_ok(
  $$insert into public.time_blocks (barbershop_id, starts_at, ends_at, reason)
    values ('aaaaaaaa-0000-0000-0000-000000000000', '2026-12-24 19:00Z', '2026-12-25 05:00Z',
            repeat('a', 201))$$,
  '23514', null, 'a reason over 200 characters fails'
);

reset role;
set local role anon;
select throws_ok(
  $$insert into public.time_blocks (barbershop_id, starts_at, ends_at)
    values ('aaaaaaaa-0000-0000-0000-000000000000', '2026-12-31 05:00Z', '2027-01-01 05:00Z')$$,
  '42501', null, 'anon cannot add a closure'
);
select throws_ok(
  $$delete from public.time_blocks where id = 'aaaaaaaa-0000-0000-0000-0000000000f9'$$,
  '42501', null, 'anon cannot remove a closure'
);
select is(
  (select count(*)::int from public.time_blocks where id = 'aaaaaaaa-0000-0000-0000-0000000000f9'),
  1, 'anon sees the closure, to keep it out of availability'
);

-- Anonymous visitors cannot run it --------------------------------------------------------------

select throws_ok(
  $$select public.set_holiday_openings('aaaaaaaa-0000-0000-0000-000000000000',
      '2026-11-10', '2027-11-09', '{}')$$,
  '42501', null, 'anon cannot change holidays'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  array(
    select id::text from public.time_blocks
    where id = 'aaaaaaaa-0000-0000-0000-0000000000f9' and barber_id is null
  ),
  array['aaaaaaaa-0000-0000-0000-0000000000f9'],
  'the owner reads the closure'
);
delete from public.time_blocks
where id = 'aaaaaaaa-0000-0000-0000-0000000000f9' and barber_id is null;

reset role;
select is(
  (select count(*)::int from public.time_blocks where id = 'aaaaaaaa-0000-0000-0000-0000000000f9'),
  0, 'and removes it'
);
select is(
  array(
    select holiday_date::text from public.holiday_openings
    where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'
  ),
  array['2026-12-25'],
  'the other barbershop keeps its holidays'
);

select * from finish();
rollback;
