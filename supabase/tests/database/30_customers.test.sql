-- Task 4.3, migration add_customer_anonymization: "Clientes" and "Borrar
-- cliente" (Ley 1581).
--
-- - list_customers shows the caller's customers only, with visits,
--   no-shows, the last visit and the next appointment, and searches and
--   filters them.
-- - Barbershop A does not read, edit or delete the customers of B.
-- - anonymize_customer leaves no name, email, phone or notes, keeps every
--   appointment, and refuses while an appointment is still to come.
-- - An anonymized customer stays as it is and takes no new appointment; a
--   public booking with the same email creates a new customer.
-- - A customer without appointments is really deleted.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- From task 3.5 only the app server books (book_appointment_from_app); this
-- test books as anon, so it grants it back inside this transaction only.
grant execute on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text) to anon;

select plan(42);

-- Structure and privileges -------------------------------------------------------------------

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'anonymized_at'
      and data_type = 'timestamp with time zone' and is_nullable = 'YES'
  ),
  'customers has anonymized_at, empty until the customer is deleted'
);
select has_function('public', 'anonymize_customer', array['uuid', 'uuid'], 'anonymize_customer exists');
select has_function('public', 'list_customers', array['uuid', 'text', 'text', 'integer'], 'list_customers exists');
select ok(
  (select bool_and(not prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.anonymize_customer(uuid, uuid)'::regprocedure,
     'public.list_customers(uuid, text, text, integer)'::regprocedure
   )),
  'both functions are security invoker (RLS applies) with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.anonymize_customer(uuid, uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.list_customers(uuid, text, text, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.anonymize_customer(uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.list_customers(uuid, text, text, integer)', 'EXECUTE'),
  'signed-in members call them; anon does not'
);
select ok(
  not has_function_privilege('authenticated', 'private.guard_customer_anonymization()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.check_appointment_customer()', 'EXECUTE'),
  'nobody calls the trigger functions'
);

-- Fixtures, inserted as the table owner -----------------------------------------------------------
-- Shop A takes bookings: open every day 06:00-22:00 Bogotá and on every
-- holiday of the next weeks, with barber Uno doing Corte. Shop B has one
-- customer with one appointment.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'duena-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'dueno-b@example.com');
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Barbería A', 'barberia-clientes-a', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '90 days'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Barbería B', 'barberia-clientes-b', '+573001112244',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '90 days');
insert into public.profiles (id, full_name, active, is_super_admin) values
  ('00000000-0000-0000-0000-0000000000a1', 'Dueña A', true, false),
  ('00000000-0000-0000-0000-0000000000b1', 'Dueño B', true, false);
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000000001', d, '06:00', '22:00' from generate_series(0, 6) d;
insert into public.holiday_openings (barbershop_id, holiday_date)
select 'aaaaaaaa-0000-0000-0000-000000000001', d::date
from generate_series(private.today_bogota() - 1, private.today_bogota() + 40, interval '1 day') d
where private.is_colombian_holiday(d::date);
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'Corte', 30000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active) values
  ('ba000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Uno', repeat('1', 64), 1, true),
  ('ba000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'Otro', repeat('2', 64), 1, true);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-0000000000a1', '5e000000-0000-0000-0000-0000000000a1'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-0000000000b1', '5e000000-0000-0000-0000-0000000000b1');

-- Camila: 2 visits, 2 no-shows and a cancellation, all past. Laura: an
-- appointment tomorrow. Diego: no appointment, created 40 days ago. Bruno
-- is B's.
insert into public.customers (id, barbershop_id, full_name, email, phone, notes, created_at) values
  ('c0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Camila Rojas',
   'camila@example.com', '+573001234567', 'Prefiere a Uno.', now() - interval '60 days'),
  ('c0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000001', 'Laura Vélez',
   'laura@example.com', null, null, now() - interval '5 days'),
  ('c0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000001', 'Diego Prada',
   null, '+573009998877', null, now() - interval '40 days'),
  ('c0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'Bruno Díaz',
   'bruno@example.com', '+573001234567', 'De B.', now() - interval '60 days');

insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, status, source) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1', 'ba000000-0000-0000-0000-0000000000a1',
   now() - interval '30 days', now() - interval '30 days' + interval '30 minutes', 25000, 'attended', 'web'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1', 'ba000000-0000-0000-0000-0000000000a1',
   now() - interval '20 days', now() - interval '20 days' + interval '30 minutes', 40000, 'attended', 'manual'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1', 'ba000000-0000-0000-0000-0000000000a1',
   now() - interval '10 days', now() - interval '10 days' + interval '30 minutes', 25000, 'no_show', 'web'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1', 'ba000000-0000-0000-0000-0000000000a1',
   now() - interval '5 days', now() - interval '5 days' + interval '30 minutes', 25000, 'no_show', 'web'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1', 'ba000000-0000-0000-0000-0000000000a1',
   now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', 25000, 'cancelled_by_customer', 'web'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a2', 'ba000000-0000-0000-0000-0000000000a1',
   now() + interval '1 day', now() + interval '1 day' + interval '30 minutes', 25000, 'confirmed', 'web'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000b1', 'ba000000-0000-0000-0000-0000000000b1',
   now() - interval '7 days', now() - interval '7 days' + interval '30 minutes', 30000, 'attended', 'web');

-- The instant of hh:mm Bogotá, `days` days from today in Bogotá.
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

grant execute on function pg_temp.at(integer, text), pg_temp.hint_of(text) to anon, authenticated;

-- Owner A: the list ---------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select results_eq(
  $$ select full_name, visits, no_shows, last_visit_at is not null, next_appointment_at is not null
     from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001') $$,
  $$ values ('Camila Rojas'::text, 2, 2, true, false),
            ('Diego Prada'::text, 0, 0, false, false),
            ('Laura Vélez'::text, 0, 0, false, true) $$,
  'A lists its customers in alphabetical order, with visits, no-shows, the last visit and the next appointment'
);
select is(
  (select last_visit_at from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001') where full_name = 'Camila Rojas'),
  (select max(starts_at) from public.appointments where customer_id = 'c0000000-0000-0000-0000-0000000000a1' and status = 'attended'),
  'the last visit is the last attended appointment'
);
select is_empty(
  $$ select * from public.list_customers('bbbbbbbb-0000-0000-0000-000000000001') $$,
  'A lists none of the customers of B'
);
select is(
  array(select full_name from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001', 'VÉLEZ')),
  array['Laura Vélez'], 'the search ignores case and accents'
);
select is(
  array(select full_name from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001', 'camila@')),
  array['Camila Rojas'], 'it finds the email'
);
select is(
  array(select full_name from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001', '300 999')),
  array['Diego Prada'], 'and the phone by its digits, however they are typed'
);
select is_empty(
  $$ select * from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001', '%') $$,
  'a % is a character, not a wildcard'
);
select is(
  array(select full_name from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001', null, 'no_shows')),
  array['Camila Rojas'], 'the filter "Con inasistencias" keeps who missed one or more'
);
select is(
  array(select full_name from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001', null, 'new')),
  array['Laura Vélez'], 'the filter "Nuevos" keeps the customers of the last 30 days'
);
select is(
  (select count(*) from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001', p_limit => 2))::integer,
  2, 'at most p_limit rows'
);

-- Owner A against B ---------------------------------------------------------------------------------

select is_empty($$ select id from public.customers where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'A does not read the customers of B');
update public.customers set notes = 'Hackeado' where id = 'c0000000-0000-0000-0000-0000000000b1';
delete from public.customers where id = 'c0000000-0000-0000-0000-0000000000b1';
select is(
  pg_temp.hint_of($$ select public.anonymize_customer('bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000b1') $$),
  'customer_not_found', 'A cannot delete a customer of B'
);
select is(
  pg_temp.hint_of($$ select public.anonymize_customer('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000b1') $$),
  'customer_not_found', 'not even naming its own barbershop'
);

reset role;
select results_eq(
  $$ select full_name, email, notes, anonymized_at is null from public.customers where id = 'c0000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('Bruno Díaz'::text, 'bruno@example.com'::text, 'De B.'::text, true) $$,
  'the customer of B is as it was: not edited, deleted or anonymized'
);

-- Owner A: notes and "Borrar cliente" ---------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

update public.customers set notes = 'Degradado bajo.' where id = 'c0000000-0000-0000-0000-0000000000a1';
select is((select notes from public.customers where id = 'c0000000-0000-0000-0000-0000000000a1'), 'Degradado bajo.',
  'A saves the notes of its customer');

select is(
  pg_temp.hint_of($$ select public.anonymize_customer('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a2') $$),
  'has_upcoming_appointments', 'a customer with an appointment to come is not deleted'
);
select is(
  pg_temp.hint_of($$ update public.customers
                     set full_name = 'Cliente borrado', email = null, phone = null, notes = null, anonymized_at = now()
                     where id = 'c0000000-0000-0000-0000-0000000000a2' $$),
  'has_upcoming_appointments', 'nor by updating the row directly'
);
select is(
  pg_temp.hint_of($$ update public.customers set anonymized_at = now() where id = 'c0000000-0000-0000-0000-0000000000a1' $$),
  '23514', 'the mark alone, with the data still there, is refused'
);
select is(
  pg_temp.hint_of($$ insert into public.customers (barbershop_id, full_name, anonymized_at)
                     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Cliente borrado', now()) $$),
  'customer_anonymized', 'nor is a new customer born anonymized'
);

select is(
  pg_temp.hint_of($$ select public.anonymize_customer('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1') $$),
  'no error', 'A deletes Camila'
);
select results_eq(
  $$ select full_name, email, phone, notes, anonymized_at is not null
     from public.customers where id = 'c0000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('Cliente borrado'::text, null::text, null::text, null::text, true) $$,
  'her name, email, phone and notes are gone, and the row says when'
);
select is(
  (select count(*) from public.appointments where customer_id = 'c0000000-0000-0000-0000-0000000000a1')::integer,
  5, 'her five appointments stay'
);
select is(
  (select sum(price_cop) from public.appointments
   where customer_id = 'c0000000-0000-0000-0000-0000000000a1' and status = 'attended')::integer,
  65000, 'with their prices, for the accounts'
);
select is(
  array(select full_name from public.list_customers('aaaaaaaa-0000-0000-0000-000000000001')),
  array['Diego Prada', 'Laura Vélez'], 'she leaves the list'
);
select is(
  pg_temp.hint_of($$ update public.customers set notes = 'Otra vez' where id = 'c0000000-0000-0000-0000-0000000000a1' $$),
  'customer_anonymized', 'an anonymized customer is not edited'
);
select is(
  pg_temp.hint_of($$ update public.customers set full_name = 'Camila Rojas', anonymized_at = null
                     where id = 'c0000000-0000-0000-0000-0000000000a1' $$),
  'customer_anonymized', 'nor brought back'
);
select is(
  pg_temp.hint_of($$ select public.anonymize_customer('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1') $$),
  'customer_not_found', 'deleting her again finds nobody'
);
-- The guard is a trigger, so it holds for any writer. Since task 4.2b a
-- session writes appointments only through security definer functions, which
-- write as their owner: these run that way.
reset role;
select is(
  pg_temp.hint_of($$ select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1',
                       'ba000000-0000-0000-0000-0000000000a1', pg_temp.at(3, '10:00'),
                       array['5e000000-0000-0000-0000-0000000000a1']::uuid[]) $$),
  'customer_anonymized', 'she takes no new appointment'
);
select is(
  pg_temp.hint_of($$ update public.appointments set status = 'confirmed'
                     where customer_id = 'c0000000-0000-0000-0000-0000000000a1' and status = 'cancelled_by_customer' $$),
  'customer_anonymized', 'nor is a cancelled one of hers brought back'
);
select is(
  pg_temp.hint_of($$ update public.appointments set customer_id = 'c0000000-0000-0000-0000-0000000000a1'
                     where customer_id = 'c0000000-0000-0000-0000-0000000000a2' $$),
  'customer_anonymized', 'nor is another appointment given to her'
);
select is(
  pg_temp.hint_of($$ update public.appointments set status = 'attended'
                     where customer_id = 'c0000000-0000-0000-0000-0000000000a1' and status = 'no_show'
                       and starts_at < now() - interval '7 days' $$),
  'no error', 'her past appointments can still be marked'
);
set local role authenticated;

select is(
  pg_temp.hint_of($$ select public.anonymize_customer('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a3') $$),
  'no error', 'A deletes Diego, who has no appointment'
);
select is_empty($$ select id from public.customers where id = 'c0000000-0000-0000-0000-0000000000a3' $$,
  'and his row is really gone');

reset role;

-- The same email books again, as anon ----------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  pg_temp.hint_of($$ select public.book_appointment(
     p_barbershop_id => 'aaaaaaaa-0000-0000-0000-000000000001', p_barber_id => 'ba000000-0000-0000-0000-0000000000a1',
     p_starts_at => pg_temp.at(2, '10:00'), p_service_ids => array['5e000000-0000-0000-0000-0000000000a1']::uuid[],
     p_customer_name => 'Camila Rojas', p_customer_email => 'camila@example.com',
     p_manage_token_hash => repeat('e', 64)) $$),
  'no error', 'a public booking with her email works'
);

reset role;

select results_eq(
  $$ select c.full_name, c.email, c.id <> 'c0000000-0000-0000-0000-0000000000a1'
     from public.appointments a
     join public.customers c on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
     where a.manage_token_hash = repeat('e', 64) $$,
  $$ values ('Camila Rojas'::text, 'camila@example.com'::text, true) $$,
  'and it belongs to a new customer, not to the deleted one'
);
select is(
  (select count(*) from public.customers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001')::integer,
  3, 'A has Laura, the deleted Camila and the new one'
);

select * from finish();
rollback;
