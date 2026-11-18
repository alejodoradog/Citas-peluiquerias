-- Task 8.14, migration owner_blocks_own_agenda: the owner blocks their own
-- agenda ("Mi agenda"), another professional's or the whole establishment,
-- and nothing that is already closed is blocked again.
--
-- - private.block_has_open_time is the rule of task 7.4 in one body, exact
--   (ranges, not quarter hours), for a professional and for the whole
--   establishment; nobody calls it directly.
-- - create_time_block (the owner's): a block of one professional is refused
--   with already_closed when nothing of it is open for them (outside their
--   hours, a day they do not work, a holiday not opened, hours the
--   establishment closed); a closure of the whole establishment, when the
--   establishment is closed for all of it. A block that reaches open hours
--   is taken, also "Todo el día", and the others stay bookable.
-- - What already held still holds: no appointment in between, the owner of
--   THAT establishment, its professional, active; a paused establishment is
--   read only. Another owner, a professional with an account, a super admin,
--   the server key and anon cannot.
-- - The professional's own block (create_my_time_block) keeps its rules on
--   the shared body.
--
-- The calendar never decides: every holiday of the window is opened, and the
-- holiday that is not opened is checked on a fixed date (2027-01-01).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(66);

-- Helpers ----------------------------------------------------------------------------------------

create function pg_temp.h(token text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;

-- Bogotá's date `days` days from today.
create function pg_temp.d(days integer)
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Bogota')::date + days
$$;

-- The instant of hh:mm Bogotá, `days` days from today ('24:00' is the next midnight).
create function pg_temp.at(days integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select (pg_temp.d(days) + hhmm::time) at time zone 'America/Bogota'
$$;

-- The hint of the error a statement raises (or its SQLSTATE), or 'no error'.
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

-- The owner's block in sede A, by the session's role.
create function pg_temp.block(barber uuid, starts_at timestamptz, ends_at timestamptz)
returns text
language sql
as $$
  select pg_temp.hint_of(format(
    'select public.create_time_block(%L, %L, %L, %L, null)',
    'aaaaaaaa-0000-0000-0000-000000008601', barber, starts_at, ends_at))
$$;

-- The owner's block in any establishment, by the session's role.
create function pg_temp.block_in(shop uuid, barber uuid, starts_at timestamptz, ends_at timestamptz)
returns text
language sql
as $$
  select pg_temp.hint_of(format(
    'select public.create_time_block(%L, %L, %L, %L, null)', shop, barber, starts_at, ends_at))
$$;

grant execute on function pg_temp.h(text), pg_temp.d(integer), pg_temp.at(integer, text),
  pg_temp.hint_of(text), pg_temp.block(uuid, timestamptz, timestamptz),
  pg_temp.block_in(uuid, uuid, timestamptz, timestamptz)
  to anon, authenticated, service_role;

-- As 84: only the app server books; anon books here, inside this transaction.
grant execute on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text) to anon;

-- Structure and privileges -------------------------------------------------------------------------

select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.create_time_block(uuid, uuid, timestamptz, timestamptz, text)'::regprocedure),
  'create_time_block stays security definer with an empty search_path'
);
-- Who may call it, each role on its own (review of 8.14, B2). The server
-- key keeps the grant every function of public has in Supabase; without an
-- owner in the session it only ever gets not_found (section 4).
select is(
  array[
    has_function_privilege('public', 'public.create_time_block(uuid, uuid, timestamptz, timestamptz, text)', 'EXECUTE'),
    has_function_privilege('anon', 'public.create_time_block(uuid, uuid, timestamptz, timestamptz, text)', 'EXECUTE'),
    has_function_privilege('authenticated', 'public.create_time_block(uuid, uuid, timestamptz, timestamptz, text)', 'EXECUTE'),
    has_function_privilege('service_role', 'public.create_time_block(uuid, uuid, timestamptz, timestamptz, text)', 'EXECUTE')
  ],
  array[false, false, true, true],
  'create_time_block: not public, not anon; authenticated and the server key'
);
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'private.block_has_open_time(uuid, uuid, timestamptz, timestamptz)'::regprocedure),
  'the shared rule is security invoker with an empty search_path'
);
select is(
  (select array_agg(has_function_privilege(r, f, 'EXECUTE') order by f, r)
   from unnest(array['public', 'anon', 'authenticated', 'service_role']) r,
        unnest(array[
          'private.block_has_open_time(uuid, uuid, timestamptz, timestamptz)',
          'private.create_time_block_of(private.barber_access, timestamptz, timestamptz, text)'
        ]) f),
  array_fill(false, array[8]),
  'nobody calls the two private functions directly'
);

-- Fixtures, inserted as the table owner --------------------------------------------------------------
-- Sede A (owner a): open 06:00 to 22:00 every day but the weekday of d(6).
-- Dueña (is_owner) works 08:00 to 12:00 every day but the weekday of d(3);
-- Otro and Cuenta (a professional with an account) use the establishment's
-- hours; Inactivo is inactive and Borrado deleted. A closure of the whole
-- establishment on d(4), 08:00 to 12:00, and an appointment of Otro on d(1)
-- at 10:00. Sede B (owner b) with Tres. Sede P (owner a too) is paused.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000860a', 'duena-a-8614@example.com'),
  ('00000000-0000-0000-0000-00000000860b', 'dueno-b-8614@example.com'),
  ('00000000-0000-0000-0000-00000000860c', 'cuenta-8614@example.com'),
  ('00000000-0000-0000-0000-00000000860d', 'admin-8614@example.com');
insert into public.profiles (id, full_name, is_super_admin, terms_accepted_at) values
  ('00000000-0000-0000-0000-00000000860a', 'Dueña A', false, now()),
  ('00000000-0000-0000-0000-00000000860b', 'Dueño B', false, now()),
  ('00000000-0000-0000-0000-00000000860c', 'Cuenta', false, now()),
  ('00000000-0000-0000-0000-00000000860d', 'Admin', true, now());

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000008601', 'Sede A', 'sede-a-8614', '+573001112233',
   private.today_bogota() + 40, private.today_bogota() + 40, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000008602', 'Sede B', 'sede-b-8614', '+573001112244',
   private.today_bogota() + 40, private.today_bogota() + 40, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000008603', 'Sede P', 'sede-p-8614', '+573001112255',
   private.today_bogota() + 40, private.today_bogota() + 40, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000008604', 'Sede S', 'sede-s-8614', '+573001112266',
   private.today_bogota() + 40, private.today_bogota() + 40, now() - interval '3 days'),
  -- Deleted once its fixtures are in.
  ('aaaaaaaa-0000-0000-0000-000000008605', 'Sede D', 'sede-d-8614', '+573001112277',
   private.today_bogota() + 40, private.today_bogota() + 40, now() - interval '3 days'),
  -- Awaiting its first payment, as Sede Tres of 50: still writable (decision S5).
  ('aaaaaaaa-0000-0000-0000-000000008606', 'Sede W', 'sede-w-8614', '+573001112288',
   private.today_bogota() - 1, private.today_bogota() - 1, now());
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000860a', 'aaaaaaaa-0000-0000-0000-000000008601', 'owner'),
  ('00000000-0000-0000-0000-00000000860a', 'aaaaaaaa-0000-0000-0000-000000008603', 'owner'),
  ('00000000-0000-0000-0000-00000000860a', 'aaaaaaaa-0000-0000-0000-000000008605', 'owner'),
  ('00000000-0000-0000-0000-00000000860a', 'aaaaaaaa-0000-0000-0000-000000008606', 'owner'),
  ('00000000-0000-0000-0000-00000000860b', 'aaaaaaaa-0000-0000-0000-000000008602', 'owner');

insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select b.id, wd, '06:00', '22:00'
from public.barbershops b, generate_series(0, 6) wd
where b.slug like '%-8614'
  and not (b.id = 'aaaaaaaa-0000-0000-0000-000000008601' and wd = extract(dow from pg_temp.d(6)));
insert into public.holiday_openings (barbershop_id, holiday_date)
select b.id, gs::date
from public.barbershops b,
     generate_series(private.today_bogota() - 1, private.today_bogota() + 40, interval '1 day') gs
where b.slug like '%-8614' and private.is_colombian_holiday(gs::date);

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000008601', 'aaaaaaaa-0000-0000-0000-000000008601', 'Corte', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, sort_order, active, is_owner, uses_barbershop_hours) values
  ('ba000000-0000-0000-0000-000000008601', 'aaaaaaaa-0000-0000-0000-000000008601', 'Dueña', 1, true, true, false),
  ('ba000000-0000-0000-0000-000000008602', 'aaaaaaaa-0000-0000-0000-000000008601', 'Otro', 2, true, false, true),
  ('ba000000-0000-0000-0000-000000008603', 'aaaaaaaa-0000-0000-0000-000000008601', 'Cuenta', 3, true, false, true),
  ('ba000000-0000-0000-0000-000000008604', 'aaaaaaaa-0000-0000-0000-000000008601', 'Inactivo', 4, false, false, true),
  ('ba000000-0000-0000-0000-000000008605', 'aaaaaaaa-0000-0000-0000-000000008601', 'Borrado', 5, false, false, true),
  ('ba000000-0000-0000-0000-000000008606', 'aaaaaaaa-0000-0000-0000-000000008602', 'Tres', 1, true, false, true),
  ('ba000000-0000-0000-0000-000000008607', 'aaaaaaaa-0000-0000-0000-000000008603', 'Pausado', 1, true, true, true),
  ('ba000000-0000-0000-0000-000000008608', 'aaaaaaaa-0000-0000-0000-000000008601', 'Partido', 6, true, false, false),
  ('ba000000-0000-0000-0000-000000008609', 'aaaaaaaa-0000-0000-0000-000000008605', 'Uno D', 1, true, false, true),
  ('ba000000-0000-0000-0000-000000008610', 'aaaaaaaa-0000-0000-0000-000000008606', 'Uno W', 1, true, false, true);
-- Partido has a split shift: 08:00 to 12:00 and 14:00 to 18:00, every day.
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000008601', 'ba000000-0000-0000-0000-000000008608', wd, s::time, e::time
from generate_series(0, 6) wd, (values ('08:00', '12:00'), ('14:00', '18:00')) shift(s, e);
-- Sede B opens in two spans on the weekday of d(2): 08:00 to 12:00 and 14:00 to 18:00.
delete from public.barbershop_hours
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008602' and weekday = extract(dow from pg_temp.d(2));
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000008602', extract(dow from pg_temp.d(2)), '08:00', '12:00'),
  ('aaaaaaaa-0000-0000-0000-000000008602', extract(dow from pg_temp.d(2)), '14:00', '18:00');
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000008601', 'ba000000-0000-0000-0000-000000008601', wd, '08:00', '12:00'
from generate_series(0, 6) wd
where wd <> extract(dow from pg_temp.d(3));
insert into public.barber_services (barbershop_id, barber_id, service_id)
select 'aaaaaaaa-0000-0000-0000-000000008601', id, '5e000000-0000-0000-0000-000000008601'
from public.barbers
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008601';
update public.barbers set profile_id = '00000000-0000-0000-0000-00000000860c'
where id = 'ba000000-0000-0000-0000-000000008603';
update public.barbers
set deleted_at = now(), display_name = 'Profesional eliminado',
    email = null, photo_path = null, email_notifications = false, link_active = false
where id = 'ba000000-0000-0000-0000-000000008605';

insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-000000008601', 'aaaaaaaa-0000-0000-0000-000000008601', 'Camila Rojas', 'camila-8614@example.com');
insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, status) values
  ('aaaaaaaa-0000-0000-0000-000000008601', 'c0000000-0000-0000-0000-000000008601', 'ba000000-0000-0000-0000-000000008602',
   pg_temp.at(1, '10:00'), pg_temp.at(1, '10:30'), 25000, 'manual', 'confirmed');
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('aaaaaaaa-0000-0000-0000-000000008601', null, pg_temp.at(4, '08:00'), pg_temp.at(4, '12:00'), 'Inventario'),
  -- A closure of several days: from d(9) at 20:00 to d(10) at 12:00.
  ('aaaaaaaa-0000-0000-0000-000000008601', null, pg_temp.at(9, '20:00'), pg_temp.at(10, '12:00'), 'Viaje');

-- Sede P is paused and Sede D deleted once their fixtures are in.
update public.barbershops set subscription_status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000008603';
update public.barbershops set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000008605';

-- 1. The shared rule, as the table owner (no window, so fixed dates) -----------------------------------

select is(
  private.block_has_open_time('aaaaaaaa-0000-0000-0000-000000008601', 'ba000000-0000-0000-0000-000000008602',
    timestamptz '2027-01-01 10:00-05', timestamptz '2027-01-01 11:00-05'),
  false,
  'a holiday the establishment does not open has nothing open for a professional'
);
select is(
  private.block_has_open_time('aaaaaaaa-0000-0000-0000-000000008601', null,
    timestamptz '2027-01-01 00:00-05', timestamptz '2027-01-02 00:00-05'),
  false,
  'nor for the whole establishment'
);
insert into public.holiday_openings (barbershop_id, holiday_date)
values ('aaaaaaaa-0000-0000-0000-000000008601', date '2027-01-01');
select is(
  private.block_has_open_time('aaaaaaaa-0000-0000-0000-000000008601', 'ba000000-0000-0000-0000-000000008602',
    timestamptz '2027-01-01 10:00-05', timestamptz '2027-01-01 11:00-05'),
  true,
  'once opened, the holiday has its weekday''s hours'
);
-- A closure off the quarter hours (the owner may write one straight to the
-- table, D-59): what is left open is still seen.
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at)
values ('aaaaaaaa-0000-0000-0000-000000008601', null,
  timestamptz '2027-01-01 10:07-05', timestamptz '2027-01-01 10:52-05');
select is(
  private.block_has_open_time('aaaaaaaa-0000-0000-0000-000000008601', 'ba000000-0000-0000-0000-000000008602',
    timestamptz '2027-01-01 10:45-05', timestamptz '2027-01-01 11:00-05'),
  true,
  'the rule is exact: 10:52 to 11:00 is still open'
);
select is(
  private.block_has_open_time('aaaaaaaa-0000-0000-0000-000000008601', 'ba000000-0000-0000-0000-000000008602',
    timestamptz '2027-01-01 10:15-05', timestamptz '2027-01-01 10:45-05'),
  false,
  'and 10:15 to 10:45 is closed'
);

-- 2. The owner of A, by their session ------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000860a", "role": "authenticated"}';

-- Mi agenda
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(1, '09:00'), pg_temp.at(1, '10:00')),
  'no error', 'the owner blocks their own agenda');
select is(
  (select count(*)::integer from public.time_blocks
   where barber_id = 'ba000000-0000-0000-0000-000000008601' and starts_at = pg_temp.at(1, '09:00')),
  1, 'the block is of their own row, not of the establishment');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00')),
  'already_closed', 'not outside their own hours');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(1, '11:30'), pg_temp.at(1, '13:00')),
  'no error', 'but a block that reaches into their hours is taken');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(3, '09:00'), pg_temp.at(3, '10:00')),
  'already_closed', 'not on a day they do not work');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(3, '00:00'), pg_temp.at(3, '24:00')),
  'already_closed', 'not even the whole day');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(4, '09:00'), pg_temp.at(4, '10:00')),
  'already_closed', 'not over hours the establishment closed');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(4, '00:00'), pg_temp.at(4, '24:00')),
  'already_closed', 'nor the whole day when the closure takes all their hours');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(6, '09:00'), pg_temp.at(6, '10:00')),
  'already_closed', 'nor a day the establishment does not open');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(2, '00:00'), pg_temp.at(2, '24:00')),
  'no error', '"Todo el día" on a day they work');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00')),
  'overlaps_block', 'and nothing more that day: it is blocked already');

-- Another professional
select is(pg_temp.block('ba000000-0000-0000-0000-000000008602', pg_temp.at(1, '10:00'), pg_temp.at(1, '11:00')),
  'overlaps_appointment', 'never over an appointment of the professional');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008602', pg_temp.at(1, '22:00'), pg_temp.at(1, '23:00')),
  'already_closed', 'not outside the hours of another professional');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008602', pg_temp.at(4, '08:00'), pg_temp.at(4, '12:00')),
  'already_closed', 'not inside a closure');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008602', pg_temp.at(4, '11:00'), pg_temp.at(4, '13:00')),
  'no error', 'a block that runs past a closure is taken, as the professional''s own');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008602', pg_temp.at(4, '13:00'), pg_temp.at(4, '13:00') + interval '7 minutes'),
  'range_invalid', 'still in quarter hours, whatever the booking interval');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008604', pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00')),
  'barber_inactive', 'not an inactive professional');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008605', pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00')),
  'barber_inactive', 'nor a deleted one');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008606', pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00')),
  'barber_not_found', 'nor one of another establishment');
-- A split shift (review of 8.14, B2).
select is(pg_temp.block('ba000000-0000-0000-0000-000000008608', pg_temp.at(1, '12:00'), pg_temp.at(1, '14:00')),
  'already_closed', 'not the gap of a split shift');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008608', pg_temp.at(1, '11:00'), pg_temp.at(1, '15:00')),
  'no error', 'but a block over the gap that reaches both shifts is taken');
-- A closure of several days that started the day before (review of 8.14, B2).
select is(pg_temp.block('ba000000-0000-0000-0000-000000008602', pg_temp.at(10, '09:00'), pg_temp.at(10, '11:00')),
  'already_closed', 'not inside a closure that began the day before');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008602', pg_temp.at(10, '11:00'), pg_temp.at(10, '13:00')),
  'no error', 'but past its end it is taken');

-- The whole establishment
select is(pg_temp.block(null, pg_temp.at(4, '09:00'), pg_temp.at(4, '11:00')),
  'already_closed', 'a closure inside a closure is refused');
select is(pg_temp.block(null, pg_temp.at(5, '22:00'), pg_temp.at(5, '24:00')),
  'already_closed', 'and outside the establishment''s hours');
select is(pg_temp.block(null, pg_temp.at(6, '00:00'), pg_temp.at(6, '24:00')),
  'already_closed', 'and a whole day it does not open');
select is(pg_temp.block(null, pg_temp.at(4, '07:00'), pg_temp.at(4, '09:00')),
  'overlaps_block', 'a closure that runs into another one clashes, as before');
select is(pg_temp.block(null, pg_temp.at(1, '10:00'), pg_temp.at(1, '11:00')),
  'overlaps_appointment', 'never over an appointment of anyone');
select is(pg_temp.block(null, pg_temp.at(5, '21:00'), pg_temp.at(5, '23:00')),
  'no error', 'a closure that reaches open hours is taken');
select is(pg_temp.block(null, pg_temp.at(7, '05:00'), pg_temp.at(7, '07:00')),
  'no error', 'also when only one hour of it is open');
select is(pg_temp.block(null, pg_temp.at(10, '00:00'), pg_temp.at(10, '12:00')),
  'already_closed', 'a closure inside one that began the day before is refused');

-- What already held
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(-1, '09:00'), pg_temp.at(-1, '10:00')),
  'too_early', 'never in the past');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(31, '09:00'), pg_temp.at(31, '10:00')),
  'range_invalid', 'up to 30 days ahead');
select is(
  pg_temp.hint_of(format('select public.create_time_block(%L, %L, %L, %L, null)',
    'aaaaaaaa-0000-0000-0000-000000008603', 'ba000000-0000-0000-0000-000000008607',
    pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00'))),
  'barbershop_read_only', 'a paused establishment takes no blocks, not even of the owner');
-- Review of 8.14, B1: being paused is said first, before the time rules.
select is(
  pg_temp.block_in('aaaaaaaa-0000-0000-0000-000000008603', 'ba000000-0000-0000-0000-000000008607',
    pg_temp.at(2, '22:00'), pg_temp.at(2, '24:00')),
  'barbershop_read_only', 'paused, even on hours already closed');
select is(
  pg_temp.block_in('aaaaaaaa-0000-0000-0000-000000008603', null, pg_temp.at(-1, '10:00'), pg_temp.at(-1, '11:00')),
  'barbershop_read_only', 'and even in the past');
select is(
  pg_temp.block_in('aaaaaaaa-0000-0000-0000-000000008606', 'ba000000-0000-0000-0000-000000008610',
    pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00')),
  'no error', 'an establishment awaiting its first payment still takes blocks (decision S5)');
select is(
  pg_temp.block_in('aaaaaaaa-0000-0000-0000-000000008605', 'ba000000-0000-0000-0000-000000008609',
    pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00')),
  'not_found', 'a deleted establishment is not found, not even by its owner');

-- 3. The others stay bookable (anon, the public booking) --------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment(p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000008601',
      p_barber_id => 'ba000000-0000-0000-0000-000000008601', p_starts_at => %L,
      p_service_ids => array['5e000000-0000-0000-0000-000000008601']::uuid[],
      p_customer_name => 'Laura Mora', p_customer_email => 'laura-8614@example.com',
      p_customer_phone => null, p_manage_token_hash => %L)$$,
    pg_temp.at(2, '09:00'), pg_temp.h('dueña-bloqueada'))),
  'blocked',
  'nobody books the owner on the day they blocked'
);
select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment(p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000008601',
      p_barber_id => 'ba000000-0000-0000-0000-000000008602', p_starts_at => %L,
      p_service_ids => array['5e000000-0000-0000-0000-000000008601']::uuid[],
      p_customer_name => 'Tomás Pérez', p_customer_email => 'tomas-8614@example.com',
      p_customer_phone => null, p_manage_token_hash => %L)$$,
    pg_temp.at(2, '09:00'), pg_temp.h('otro-libre'))),
  'no error',
  'while the rest of the team is booked at that hour'
);
-- Review of 8.14, B3: refused for lack of EXECUTE on this function, not
-- for any other permission.
select ok(
  not has_function_privilege('anon', 'public.create_time_block(uuid, uuid, timestamptz, timestamptz, text)', 'EXECUTE'),
  'anon has no EXECUTE on create_time_block'
);
select throws_ok(
  format('select public.create_time_block(%L, null, %L, %L, null)',
    'aaaaaaaa-0000-0000-0000-000000008601', pg_temp.at(8, '10:00'), pg_temp.at(8, '11:00')),
  '42501', 'permission denied for function create_time_block', 'anon cannot block'
);

-- 4. Who cannot ----------------------------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000860b", "role": "authenticated"}';
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(8, '09:00'), pg_temp.at(8, '10:00')),
  'not_found', 'the owner of another establishment cannot block the agenda of A''s owner');
select is(pg_temp.block(null, pg_temp.at(8, '09:00'), pg_temp.at(8, '10:00')),
  'not_found', 'nor close A');
-- Two spans of the establishment on one day, for the whole establishment
-- (review of 8.14, B2): Sede B, 08:00 to 12:00 and 14:00 to 18:00 on d(2).
select is(pg_temp.block_in('aaaaaaaa-0000-0000-0000-000000008602', null, pg_temp.at(2, '12:00'), pg_temp.at(2, '14:00')),
  'already_closed', 'a closure of the gap between two spans is refused');
select is(pg_temp.block_in('aaaaaaaa-0000-0000-0000-000000008602', null, pg_temp.at(2, '11:00'), pg_temp.at(2, '15:00')),
  'no error', 'a closure that reaches both spans is taken');
select is(pg_temp.block_in('aaaaaaaa-0000-0000-0000-000000008602', null, pg_temp.at(2, '18:00'), pg_temp.at(2, '24:00')),
  'already_closed', 'and after the second span it is refused');
select is(
  pg_temp.hint_of(format('select public.create_time_block(%L, %L, %L, %L, null)',
    'aaaaaaaa-0000-0000-0000-000000008602', 'ba000000-0000-0000-0000-000000008601',
    pg_temp.at(8, '09:00'), pg_temp.at(8, '10:00'))),
  'barber_not_found', 'nor reach A''s owner from their own establishment');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000860c", "role": "authenticated"}';
select is(pg_temp.block('ba000000-0000-0000-0000-000000008601', pg_temp.at(8, '09:00'), pg_temp.at(8, '10:00')),
  'not_found', 'a professional with an account cannot block the owner');
select is(pg_temp.block('ba000000-0000-0000-0000-000000008603', pg_temp.at(8, '09:00'), pg_temp.at(8, '10:00')),
  'not_found', 'nor themselves by the owner''s function');
-- Their own block keeps the rules of 7.4, now on the shared body.
select is(pg_temp.hint_of(format('select public.create_my_time_block(%L, %L, null)', pg_temp.at(4, '08:00'), pg_temp.at(4, '12:00'))),
  'already_closed', 'their own block inside a closure is refused, as before');
select is(pg_temp.hint_of(format('select public.create_my_time_block(%L, %L, null)', pg_temp.at(4, '00:00'), pg_temp.at(4, '24:00'))),
  'no error', 'and their whole day, which reaches open hours, is taken');

reset role;
-- One owner per establishment: the super admin gets a membership of Sede S.
insert into public.memberships (user_id, barbershop_id, role)
values ('00000000-0000-0000-0000-00000000860d', 'aaaaaaaa-0000-0000-0000-000000008604', 'owner');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000860d", "role": "authenticated"}';
select is(
  pg_temp.hint_of(format('select public.create_time_block(%L, null, %L, %L, null)',
    'aaaaaaaa-0000-0000-0000-000000008604', pg_temp.at(8, '09:00'), pg_temp.at(8, '10:00'))),
  'not_found', 'a super admin is never a member, not even with a membership');
select is(pg_temp.block(null, pg_temp.at(8, '09:00'), pg_temp.at(8, '10:00')),
  'not_found', 'nor reaches A');

reset role;
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select is(pg_temp.block(null, pg_temp.at(8, '09:00'), pg_temp.at(8, '10:00')),
  'not_found', 'the server key has no owner: not found, never a private helper error');

reset role;
select is(
  (select count(*)::integer from public.time_blocks
   where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008601' and starts_at >= pg_temp.at(8, '00:00') and starts_at < pg_temp.at(9, '00:00')),
  0, 'none of those left a block');
select is(
  (select count(*)::integer from public.time_blocks
   where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008603'),
  0, 'nor the paused establishment');

select * from finish();
rollback;
