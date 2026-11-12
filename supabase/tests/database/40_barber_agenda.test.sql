-- Task 4.4, migration add_barber_agenda: "Mi agenda" of a barber, through
-- the private link /b/<token>.
--
-- - The functions take the hash of the link. A deactivated or made-up link
--   gives nothing (B-05); the link of an inactive barber still works.
-- - The barber sees only their own appointments and blocks (and the closures
--   of the whole barbershop), with the customer's short name: never a price,
--   a total, an email, a phone, notes or another barber.
-- - Marking attended or no-show needs a confirmed appointment of their own
--   that already started (decisions B2 and B3), also with the barbershop
--   suspended, and records the barber in the history.
-- - Blocks: an active barber, an active barbershop, one Bogotá day in steps
--   of 15 minutes, from now to 30 days ahead, and no appointment in between.
--   The barber removes only their own future blocks.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(65);

-- Structure and privileges -------------------------------------------------------------------

select has_function('public', 'barber_agenda', array['text', 'date', 'date'], 'barber_agenda exists');
select has_function('public', 'barber_appointment', array['text', 'uuid'], 'barber_appointment exists');
select has_function(
  'public', 'mark_appointment_by_barber', array['text', 'uuid', 'appointment_status'],
  'mark_appointment_by_barber exists'
);
select has_function(
  'public', 'create_time_block_by_barber',
  array['text', 'timestamp with time zone', 'timestamp with time zone', 'text'],
  'create_time_block_by_barber exists'
);
select has_function('public', 'delete_time_block_by_barber', array['text', 'uuid'], 'delete_time_block_by_barber exists');
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.barber_agenda(text, date, date)'::regprocedure,
     'public.barber_appointment(text, uuid)'::regprocedure,
     'public.mark_appointment_by_barber(text, uuid, public.appointment_status)'::regprocedure,
     'public.create_time_block_by_barber(text, timestamptz, timestamptz, text)'::regprocedure,
     'public.delete_time_block_by_barber(text, uuid)'::regprocedure
   )),
  'the five functions are security definer with an empty search_path'
);
select ok(
  (select bool_and(
     has_function_privilege('anon', f, 'EXECUTE') and has_function_privilege('authenticated', f, 'EXECUTE'))
   from unnest(array[
     'public.barber_agenda(text, date, date)',
     'public.barber_appointment(text, uuid)',
     'public.mark_appointment_by_barber(text, uuid, public.appointment_status)',
     'public.create_time_block_by_barber(text, timestamptz, timestamptz, text)',
     'public.delete_time_block_by_barber(text, uuid)'
   ]) f),
  'anon and authenticated call the five functions'
);
select ok(
  not has_function_privilege('anon', 'private.barber_by_link(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.barber_by_link(text)', 'EXECUTE'),
  'nobody calls the link helper directly'
);
select is(
  (select pg_get_function_result('public.barber_appointment(text, uuid)'::regprocedure)),
  'TABLE(id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, '
    'status appointment_status, source appointment_source, created_at timestamp with time zone, '
    'customer_name text, service_names text[], service_minutes integer[], visits integer, '
    'no_shows integer, writable boolean)',
  'barber_appointment returns what B-03 shows: no price, email, phone or notes'
);

-- Fixtures, inserted as the table owner -----------------------------------------------------------
-- Shop S is active; shop T is another barbershop. In S: Uno and Dos (active),
-- Cuatro (inactive, link still active) and Cinco (link deactivated). In T: Tres.

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Barbería S', 'barberia-s', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Barbería T', 'barberia-t', '+573001112244',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select s, d, '06:00', '22:00'
from generate_series(0, 6) d,
     unnest(array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[]) s;
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Barba', 15000, 15, true),
  ('5e000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Corte T', 20000, 30, true);

-- The hash of the link of a made-up token.
create function pg_temp.h(token text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;

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

-- The Bogotá date `days` days from today (anon cannot call private.today_bogota).
create function pg_temp.d(days integer)
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Bogota')::date + days
$$;

grant execute on function pg_temp.h(text), pg_temp.at(integer, text), pg_temp.hint_of(text), pg_temp.d(integer)
  to anon, authenticated;

insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active, link_active) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Kevin Mora', pg_temp.h('uno'), 1, true, true),
  ('ba000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dos', pg_temp.h('dos'), 2, true, true),
  ('ba000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cuatro', pg_temp.h('cuatro'), 4, true, true),
  ('ba000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cinco', pg_temp.h('cinco'), 5, true, false),
  ('ba000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Tres', pg_temp.h('tres'), 1, true, true);
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', 1, '09:00', '19:00');
update public.barbers set uses_barbershop_hours = false where id = 'ba000000-0000-0000-0000-000000000001';

insert into public.customers (id, barbershop_id, full_name, email, phone, notes) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Camila Rojas Pérez', 'camila@example.com', '+573009998877', 'nota privada del dueño'),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002',
   'Cliente De Te', 'te@example.com', null, null);

-- Uno: one that started 30 minutes ago (a1), one tomorrow at 10:00 (a2), a
-- cancelled one tomorrow at 12:00 (a3), an attended one last week (a6) and
-- one that started an hour ago (a7). Dos: tomorrow at 11:00 (a4). Tres, in
-- T: tomorrow at 10:00 (a5). Cuatro: tomorrow at 16:00 (a8).
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, status) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', now() - interval '30 minutes', now() + interval '15 minutes', 40000, 'web', 'confirmed'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '10:00'), pg_temp.at(1, '10:30'), 25000, 'web', 'confirmed'),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '12:00'), pg_temp.at(1, '12:30'), 25000, 'web', 'cancelled_by_customer'),
  ('a0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000002', pg_temp.at(1, '11:00'), pg_temp.at(1, '11:30'), 25000, 'manual', 'confirmed'),
  ('a0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
   'ba000000-0000-0000-0000-000000000003', pg_temp.at(1, '10:00'), pg_temp.at(1, '10:30'), 20000, 'web', 'confirmed'),
  ('a0000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', pg_temp.at(-7, '10:00'), pg_temp.at(-7, '10:30'), 25000, 'web', 'attended'),
  ('a0000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', now() - interval '60 minutes', now() - interval '45 minutes', 15000, 'manual', 'confirmed'),
  ('a0000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000004', pg_temp.at(1, '16:00'), pg_temp.at(1, '16:30'), 25000, 'manual', 'confirmed');
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id, price_cop, duration_minutes) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 1, '5e000000-0000-0000-0000-000000000001', 25000, 30),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1, '5e000000-0000-0000-0000-000000000001', 25000, 30),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 2, '5e000000-0000-0000-0000-000000000002', 15000, 15);

-- Blocks: Uno tomorrow 14:00-15:00 (b1), Dos tomorrow 14:00-15:00 (b2), the
-- whole of S closed in two days 06:00-08:00 (b3).
insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('b0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
   pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00'), 'Almuerzo'),
  ('b0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002',
   pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00'), 'Permiso'),
  ('b0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', null,
   pg_temp.at(2, '06:00'), pg_temp.at(2, '08:00'), null);

-- Older than a week: a9, confirmed, of Uno, 9 days ago. An ended block of
-- Uno three days ago (b4), and a block of Tres in T (b5).
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, status) values
  ('a0000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', pg_temp.at(-9, '10:00'), pg_temp.at(-9, '10:30'), 25000, 'manual', 'confirmed');
insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('b0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001',
   pg_temp.at(-3, '10:00'), pg_temp.at(-3, '11:00'), 'Permiso'),
  ('b0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000002', 'ba000000-0000-0000-0000-000000000003',
   pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00'), null);

-- Cuatro leaves the team, with their link still active.
update public.barbers set active = false where id = 'ba000000-0000-0000-0000-000000000004';

-- Reading, as anon -----------------------------------------------------------------------------------

-- From yesterday, so the appointments of the last hour are inside even just
-- after midnight in Bogotá.
create temporary table agenda (week_before jsonb, week jsonb) on commit drop;
grant all on agenda to anon;

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

insert into agenda
select public.barber_agenda(pg_temp.h('uno'), pg_temp.d(-8), pg_temp.d(-2)),
       public.barber_agenda(pg_temp.h('uno'), pg_temp.d(-1), pg_temp.d(5));

select is(
  (select week #>> '{barber,name}' from agenda),
  'Kevin Mora',
  'the link of Uno opens the agenda of Uno'
);
select is(
  (select array_agg(e ->> 'id' order by e ->> 'id') from agenda, jsonb_array_elements(week -> 'appointments') e),
  array['a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000007'],
  'only their own appointments that take time: not the cancelled one, not Dos, not another barbershop'
);
select is(
  (select array_agg(e ->> 'id' order by e ->> 'id') from agenda, jsonb_array_elements(week -> 'blocks') e),
  array['b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003'],
  'their own blocks and the closures of the whole barbershop, never those of Dos'
);
select is(
  (select e ->> 'customerName' from agenda, jsonb_array_elements(week -> 'appointments') e
   where e ->> 'id' = 'a0000000-0000-0000-0000-000000000001'),
  'Camila R.',
  'the customer comes as a short name'
);
select is(
  (select e -> 'services' from agenda, jsonb_array_elements(week -> 'appointments') e
   where e ->> 'id' = 'a0000000-0000-0000-0000-000000000001'),
  '["Corte", "Barba"]'::jsonb,
  'with the names of the services, in order'
);
select ok(
  (select week::text !~* '(price|camila@|\+57300999|nota privada|Rojas|Dos"|Tres|Barbería T)' from agenda),
  'no price, email, phone, notes, full name, other barber or other barbershop anywhere'
);
select is(
  (select week -> 'barbershop' from agenda),
  '{"name": "Barbería S", "writable": true}'::jsonb,
  'the barbershop and whether the agenda can be changed'
);
select is(
  (select week -> 'schedule' from agenda),
  '{"usesBarbershopHours": false, "shifts": [{"weekday": 1, "start": "09:00", "end": "19:00"}]}'::jsonb,
  'their own shifts, to draw B-02'
);
select is(
  (select jsonb_array_length(week -> 'shopHours') from agenda),
  7,
  'and the hours of the barbershop'
);
select is(
  (select jsonb_array_length(week_before -> 'appointments') from agenda),
  1,
  'past days too: the attended one of last week'
);
select is(public.barber_agenda(pg_temp.h('cinco'), pg_temp.d(0), pg_temp.d(0)), null,
  'a deactivated link gives nothing (B-05)');
select is(public.barber_agenda(pg_temp.h('inventado'), pg_temp.d(0), pg_temp.d(0)), null,
  'a made-up link gives the same nothing');
select is(public.barber_agenda('no es un hash', pg_temp.d(0), pg_temp.d(0)), null,
  'nor does something that is not a hash');
select is(
  (public.barber_agenda(pg_temp.h('cuatro'), pg_temp.d(0), pg_temp.d(1))) #> '{barber,active}',
  'false'::jsonb,
  'the link of an inactive barber still works'
);
select is(
  pg_temp.hint_of($$select public.barber_agenda(pg_temp.h('uno'), pg_temp.d(0), pg_temp.d(7))$$),
  'range_invalid',
  'at most 7 days at a time'
);
select is(
  pg_temp.hint_of($q$select public.barber_agenda(pg_temp.h('uno'), pg_temp.d(-20), pg_temp.d(-14))$q$),
  'range_invalid',
  'never weeks long gone (decision B5)'
);
select is(
  pg_temp.hint_of($q$select public.barber_agenda(pg_temp.h('uno'), pg_temp.d(31), pg_temp.d(37))$q$),
  'range_invalid',
  'nor beyond the weeks of the next 30 days'
);
select is(
  (select jsonb_array_length(public.barber_agenda(pg_temp.h('tres'), pg_temp.d(0), pg_temp.d(5)) -> 'appointments')),
  1,
  'Tres sees only the appointment of barbershop T'
);

-- B-03 -----------------------------------------------------------------------------------------------

select is(
  (select row(customer_name, service_names, service_minutes, visits, no_shows, writable)::text
   from public.barber_appointment(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000001')),
  '("Camila R.","{Corte,Barba}","{30,15}",1,0,t)',
  'B-03 shows the short name, the services with their minutes, the visits and the no-shows'
);
select is(
  (select count(*)::integer from public.barber_appointment(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000004')),
  0,
  'an appointment of Dos is not shown to Uno'
);
select is(
  (select count(*)::integer from public.barber_appointment(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000005')),
  0,
  'nor one of another barbershop'
);
select is(
  (select count(*)::integer from public.barber_appointment(pg_temp.h('cinco'), 'a0000000-0000-0000-0000-000000000001')),
  0,
  'nor anything through a deactivated link'
);
select is(
  (select count(*)::integer from public.barber_appointment(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000003')),
  0,
  'nor a cancelled appointment, as the agenda'
);

-- Marking ----------------------------------------------------------------------------------------------

select is(
  pg_temp.hint_of($$select public.mark_appointment_by_barber(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000001', 'attended')$$),
  'no error',
  'Uno marks as attended the appointment that already started'
);
reset role;
select is(
  (select status::text from public.appointments where id = 'a0000000-0000-0000-0000-000000000001'),
  'attended',
  'and it is attended'
);
select is(
  (select actor::text from public.appointment_events
   where appointment_id = 'a0000000-0000-0000-0000-000000000001' and new_status = 'attended'),
  'barber',
  'the history records the barber'
);
set local role anon;
select is(
  pg_temp.hint_of($$select public.mark_appointment_by_barber(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000001', 'no_show')$$),
  'not_confirmed',
  'a mark is not corrected from the link (decision B3)'
);
select is(
  pg_temp.hint_of($$select public.mark_appointment_by_barber(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000002', 'no_show')$$),
  'too_early',
  'an appointment that has not started cannot be marked (decision B2)'
);
select is(
  pg_temp.hint_of($$select public.mark_appointment_by_barber(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000003', 'attended')$$),
  'not_confirmed',
  'nor a cancelled one'
);
select is(
  pg_temp.hint_of($$select public.mark_appointment_by_barber(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000004', 'attended')$$),
  'not_yours',
  'nor one of Dos'
);
select is(
  pg_temp.hint_of($$select public.mark_appointment_by_barber(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000007', 'cancelled_by_barbershop')$$),
  'status_invalid',
  'the link only marks attended or no-show (decision B1)'
);
select is(
  pg_temp.hint_of($$select public.mark_appointment_by_barber(pg_temp.h('cinco'), 'a0000000-0000-0000-0000-000000000007', 'attended')$$),
  'link_invalid',
  'a deactivated link marks nothing'
);
select is(
  pg_temp.hint_of($q$select public.mark_appointment_by_barber(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000005', 'attended')$q$),
  'not_yours',
  'nor one of another barbershop'
);
select is(
  pg_temp.hint_of($q$select public.mark_appointment_by_barber(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000009', 'no_show')$q$),
  'not_yours',
  'nor one older than a week (decision B5)'
);

-- Blocks --------------------------------------------------------------------------------------------------

select is(
  pg_temp.hint_of($$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(1, '16:00'), pg_temp.at(1, '17:00'), 'Diligencia')$$),
  'no error',
  'Uno blocks tomorrow 16:00-17:00'
);
reset role;
select is(
  (select reason from public.time_blocks
   where barber_id = 'ba000000-0000-0000-0000-000000000001' and starts_at = pg_temp.at(1, '16:00')),
  'Diligencia',
  'with its reason'
);
set local role anon;
select is(
  pg_temp.hint_of($$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(1, '10:15'), pg_temp.at(1, '11:00'), null)$$),
  'overlaps_appointment',
  'not over an appointment of their own'
);
select is(
  pg_temp.hint_of($q$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(1, '14:30'), pg_temp.at(1, '15:30'), null)$q$),
  'overlaps_block',
  'nor over a block of their own'
);
select is(
  pg_temp.hint_of($q$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(1, '18:00'), pg_temp.at(1, '19:00'), 'Llama al 3001234567')$q$),
  'range_invalid',
  'only the reasons of B-04'
);
select is(
  pg_temp.hint_of($q$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(1, '18:00') + interval '400 milliseconds', pg_temp.at(1, '19:00'), null)$q$),
  'range_invalid',
  'exactly on the quarter hour, not a fraction of a second off'
);
select is(
  pg_temp.hint_of($$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(1, '10:05'), pg_temp.at(1, '10:20'), null)$$),
  'range_invalid',
  'only in steps of 15 minutes'
);
select is(
  pg_temp.hint_of($$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(1, '23:00'), pg_temp.at(2, '01:00'), null)$$),
  'range_invalid',
  'within one Bogotá day'
);
select is(
  pg_temp.hint_of($$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(31, '10:00'), pg_temp.at(31, '11:00'), null)$$),
  'range_invalid',
  'up to 30 days ahead (decision B5)'
);
select is(
  pg_temp.hint_of($$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(-1, '10:00'), pg_temp.at(-1, '11:00'), null)$$),
  'too_early',
  'never in the past'
);
select is(
  pg_temp.hint_of($$select public.create_time_block_by_barber(pg_temp.h('cuatro'), pg_temp.at(1, '10:00'), pg_temp.at(1, '11:00'), null)$$),
  'barber_inactive',
  'an inactive barber does not block'
);
select is(
  pg_temp.hint_of($$select public.delete_time_block_by_barber(pg_temp.h('uno'), 'b0000000-0000-0000-0000-000000000003')$$),
  'not_yours',
  'the barber does not remove a closure of the whole barbershop'
);
select is(
  pg_temp.hint_of($$select public.delete_time_block_by_barber(pg_temp.h('uno'), 'b0000000-0000-0000-0000-000000000002')$$),
  'not_yours',
  'nor a block of Dos'
);
select is(
  pg_temp.hint_of($q$select public.delete_time_block_by_barber(pg_temp.h('uno'), 'b0000000-0000-0000-0000-000000000005')$q$),
  'not_yours',
  'nor one of another barbershop'
);
select is(
  pg_temp.hint_of($q$select public.delete_time_block_by_barber(pg_temp.h('uno'), 'b0000000-0000-0000-0000-000000000004')$q$),
  'not_yours',
  'nor one that already ended'
);
select is(
  pg_temp.hint_of($$select public.delete_time_block_by_barber(pg_temp.h('uno'), 'b0000000-0000-0000-0000-000000000001')$$),
  'no error',
  'Uno removes their own block'
);
reset role;
select is(
  (select count(*)::integer from public.time_blocks where id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'and it is gone'
);

-- A suspended barbershop: read only, but marking still works (spec, Suscripciones, point 6) --------------

update public.barbershops set subscription_status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role anon;

select is(
  (public.barber_agenda(pg_temp.h('uno'), pg_temp.d(0), pg_temp.d(0))) #> '{barbershop,writable}',
  'false'::jsonb,
  'the agenda says it is read only (B-06)'
);
select is(
  pg_temp.hint_of($$select public.mark_appointment_by_barber(pg_temp.h('uno'), 'a0000000-0000-0000-0000-000000000007', 'no_show')$$),
  'no error',
  'a suspended barbershop still lets the barber mark a no-show'
);
select is(
  pg_temp.hint_of($$select public.create_time_block_by_barber(pg_temp.h('uno'), pg_temp.at(1, '18:00'), pg_temp.at(1, '19:00'), null)$$),
  'read_only',
  'but not block'
);
select is(
  pg_temp.hint_of($$select public.delete_time_block_by_barber(pg_temp.h('uno'), (select id from public.time_blocks where false))$$),
  'read_only',
  'nor remove a block'
);

-- A deleted barbershop: its links stop working.
reset role;
update public.barbershops set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002';
set local role anon;
select is(public.barber_agenda(pg_temp.h('tres'), pg_temp.d(0), pg_temp.d(0)), null,
  'the link of a deleted barbershop gives nothing');

select * from finish();
rollback;
