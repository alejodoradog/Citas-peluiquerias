-- Task 4.4, migration add_barber_agenda: "Mi agenda" of a barber. Since task
-- 7.6c (decision 0010) the private link is gone and "Mi agenda" is the my_*
-- functions, by the professional's own session (migrations
-- add_professional_accounts and remove_barber_link_add_barber_deletion).
-- These are the rules of the agenda, unchanged, now asked by the session:
--
-- - A session that is not of a professional (no account, or an account that
--   is no professional) gets nothing; the session of an inactive barber
--   still works.
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

select plan(72);

-- Structure and privileges -------------------------------------------------------------------

select has_function('public', 'my_agenda', array['date', 'date'], 'my_agenda exists');
select has_function('public', 'my_appointment', array['uuid'], 'my_appointment exists');
select has_function(
  'public', 'mark_my_appointment', array['uuid', 'appointment_status'],
  'mark_my_appointment exists'
);
select has_function(
  'public', 'create_my_time_block',
  array['timestamp with time zone', 'timestamp with time zone', 'text'],
  'create_my_time_block exists'
);
select has_function('public', 'delete_my_time_block', array['uuid'], 'delete_my_time_block exists');
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.my_agenda(date, date)'::regprocedure,
     'public.my_appointment(uuid)'::regprocedure,
     'public.mark_my_appointment(uuid, public.appointment_status)'::regprocedure,
     'public.create_my_time_block(timestamptz, timestamptz, text)'::regprocedure,
     'public.delete_my_time_block(uuid)'::regprocedure
   )),
  'the five functions are security definer with an empty search_path'
);
select ok(
  (select bool_and(
     has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
   from unnest(array[
     'public.my_agenda(date, date)',
     'public.my_appointment(uuid)',
     'public.mark_my_appointment(uuid, public.appointment_status)',
     'public.create_my_time_block(timestamptz, timestamptz, text)',
     'public.delete_my_time_block(uuid)'
   ]) f),
  'only a session calls the five functions; anon cannot'
);
select ok(
  not has_function_privilege('anon', 'private.barber_by_session()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.barber_by_session()', 'EXECUTE'),
  'nobody calls the session helper directly'
);
select is(
  (select pg_get_function_result('public.my_appointment(uuid)'::regprocedure)),
  'TABLE(id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, '
    'status appointment_status, source appointment_source, created_at timestamp with time zone, '
    'customer_name text, customer_phone text, service_names text[], service_minutes integer[], '
    'visits integer, no_shows integer, writable boolean)',
  'my_appointment returns what B-03 shows, plus the phone: no price, email or notes'
);

-- Fixtures, inserted as the table owner -----------------------------------------------------------
-- Shop S is active; shop T is another barbershop. In S: Uno and Dos (active),
-- Cuatro (inactive, account still joined) and Cinco (no account). In T: Tres.

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

-- The account of each barber of the fixtures (Cinco has none), and of a
-- session that is no professional at all ('inventado').
create function pg_temp.uid(who text)
returns uuid
language sql
immutable
as $$
  select case who
    when 'uno' then '00000000-0000-0000-0000-000000000401'
    when 'dos' then '00000000-0000-0000-0000-000000000402'
    when 'tres' then '00000000-0000-0000-0000-000000000403'
    when 'cuatro' then '00000000-0000-0000-0000-000000000404'
    else '00000000-0000-0000-0000-0000000004ff'
  end::uuid
$$;

-- "Mi agenda" as the session of `who`: what the app calls (task 7.6b).
create function pg_temp.as_barber(who text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(who), 'role', 'authenticated')::text, true);
$$;

create function pg_temp.agenda(who text, p_from date, p_to date)
returns jsonb
language plpgsql
as $$
begin
  perform pg_temp.as_barber(who);
  return public.my_agenda(p_from, p_to);
end;
$$;

create function pg_temp.appointment(who text, p_appointment_id uuid)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, status public.appointment_status,
  source public.appointment_source, created_at timestamptz, customer_name text, customer_phone text,
  service_names text[], service_minutes integer[], visits integer, no_shows integer, writable boolean
)
language plpgsql
as $$
#variable_conflict use_column
begin
  perform pg_temp.as_barber(who);
  return query select * from public.my_appointment(p_appointment_id);
end;
$$;

create function pg_temp.mark(who text, p_appointment_id uuid, p_status public.appointment_status)
returns void
language plpgsql
as $$
begin
  perform pg_temp.as_barber(who);
  perform public.mark_my_appointment(p_appointment_id, p_status);
end;
$$;

create function pg_temp.block(who text, p_starts_at timestamptz, p_ends_at timestamptz, p_reason text)
returns uuid
language plpgsql
as $$
begin
  perform pg_temp.as_barber(who);
  return public.create_my_time_block(p_starts_at, p_ends_at, p_reason);
end;
$$;

create function pg_temp.unblock(who text, p_block_id uuid)
returns void
language plpgsql
as $$
begin
  perform pg_temp.as_barber(who);
  perform public.delete_my_time_block(p_block_id);
end;
$$;

grant execute on function pg_temp.h(text), pg_temp.at(integer, text), pg_temp.hint_of(text), pg_temp.d(integer),
  pg_temp.uid(text), pg_temp.as_barber(text), pg_temp.agenda(text, date, date), pg_temp.appointment(text, uuid),
  pg_temp.mark(text, uuid, public.appointment_status), pg_temp.block(text, timestamptz, timestamptz, text),
  pg_temp.unblock(text, uuid)
  to authenticated;

insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active, link_active) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Kevin Mora', pg_temp.h('uno'), 1, true, true),
  ('ba000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dos', pg_temp.h('dos'), 2, true, true),
  ('ba000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cuatro', pg_temp.h('cuatro'), 4, true, true),
  ('ba000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cinco', pg_temp.h('cinco'), 5, true, false),
  ('ba000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Tres', pg_temp.h('tres'), 1, true, true);
-- Their accounts, joined and with the terms accepted (task 7.6). Cinco has
-- none; 'inventado' is an account that is no professional.
insert into auth.users (id, email)
select pg_temp.uid(w), w || '-40@example.com'
from unnest(array['uno', 'dos', 'tres', 'cuatro', 'inventado']) w;
insert into public.profiles (id, full_name, terms_accepted_at, terms_version)
select pg_temp.uid(w), w, now(), 'prueba-40'
from unnest(array['uno', 'dos', 'tres', 'cuatro', 'inventado']) w;
update public.barbers b set profile_id = pg_temp.uid(v.w)
from (values ('ba000000-0000-0000-0000-000000000001', 'uno'), ('ba000000-0000-0000-0000-000000000002', 'dos'),
             ('ba000000-0000-0000-0000-000000000003', 'tres'), ('ba000000-0000-0000-0000-000000000004', 'cuatro'))
  as v (id, w)
where b.id = v.id::uuid;
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

-- Cuatro leaves the team, with their account still joined.
update public.barbers set active = false where id = 'ba000000-0000-0000-0000-000000000004';

-- Reading, by the session -----------------------------------------------------------------------------------

-- From yesterday, so the appointments of the last hour are inside even just
-- after midnight in Bogotá.
create temporary table agenda (week_before jsonb, week jsonb) on commit drop;
grant all on agenda to authenticated;

set local role authenticated;

insert into agenda
select pg_temp.agenda('uno', pg_temp.d(-8), pg_temp.d(-2)),
       pg_temp.agenda('uno', pg_temp.d(-1), pg_temp.d(5));

select is(
  (select week #>> '{barber,name}' from agenda),
  'Kevin Mora',
  'the session of Uno opens the agenda of Uno'
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
select is(pg_temp.agenda('cinco', pg_temp.d(0), pg_temp.d(0)), null,
  'a professional without an account gets nothing');
select is(pg_temp.agenda('inventado', pg_temp.d(0), pg_temp.d(0)), null,
  'an account that is no professional gets the same nothing');
select ok(
  not has_function_privilege('anon', 'public.my_agenda(date, date)', 'EXECUTE'),
  'and without a session there is nothing to call');
select is(
  (pg_temp.agenda('cuatro', pg_temp.d(0), pg_temp.d(1))) #> '{barber,active}',
  'false'::jsonb,
  'the session of an inactive barber still works'
);
select is(
  pg_temp.hint_of($$select pg_temp.agenda('uno', pg_temp.d(0), pg_temp.d(7))$$),
  'range_invalid',
  'at most 7 days at a time'
);
select is(
  pg_temp.hint_of($q$select pg_temp.agenda('uno', pg_temp.d(-20), pg_temp.d(-14))$q$),
  'range_invalid',
  'never weeks long gone (decision B5)'
);
select is(
  pg_temp.hint_of($q$select pg_temp.agenda('uno', pg_temp.d(31), pg_temp.d(37))$q$),
  'range_invalid',
  'nor beyond the weeks of the next 30 days'
);
select is(
  (select jsonb_array_length(pg_temp.agenda('tres', pg_temp.d(0), pg_temp.d(5)) -> 'appointments')),
  1,
  'Tres sees only the appointment of barbershop T'
);

-- B-03 -----------------------------------------------------------------------------------------------

select is(
  (select row(customer_name, service_names, service_minutes, visits, no_shows, writable)::text
   from pg_temp.appointment('uno', 'a0000000-0000-0000-0000-000000000001')),
  '("Camila R.","{Corte,Barba}","{30,15}",1,0,t)',
  'B-03 shows the short name, the services with their minutes, the visits and the no-shows'
);
select is(
  (select count(*)::integer from pg_temp.appointment('uno', 'a0000000-0000-0000-0000-000000000004')),
  0,
  'an appointment of Dos is not shown to Uno'
);
select is(
  (select count(*)::integer from pg_temp.appointment('uno', 'a0000000-0000-0000-0000-000000000005')),
  0,
  'nor one of another barbershop'
);
select is(
  (select count(*)::integer from pg_temp.appointment('cinco', 'a0000000-0000-0000-0000-000000000001')),
  0,
  'nor anything for a professional without an account'
);
select is(
  (select count(*)::integer from pg_temp.appointment('uno', 'a0000000-0000-0000-0000-000000000003')),
  0,
  'nor a cancelled appointment, as the agenda'
);

-- Marking ----------------------------------------------------------------------------------------------

select is(
  pg_temp.hint_of($$select pg_temp.mark('uno', 'a0000000-0000-0000-0000-000000000001', 'attended')$$),
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
set local role authenticated;
select is(
  pg_temp.hint_of($$select pg_temp.mark('uno', 'a0000000-0000-0000-0000-000000000001', 'no_show')$$),
  'not_confirmed',
  'a mark is not corrected from Mi agenda (decision B3)'
);
select is(
  pg_temp.hint_of($$select pg_temp.mark('uno', 'a0000000-0000-0000-0000-000000000002', 'no_show')$$),
  'too_early',
  'an appointment that has not started cannot be marked (decision B2)'
);
select is(
  pg_temp.hint_of($$select pg_temp.mark('uno', 'a0000000-0000-0000-0000-000000000003', 'attended')$$),
  'not_confirmed',
  'nor a cancelled one'
);
select is(
  pg_temp.hint_of($$select pg_temp.mark('uno', 'a0000000-0000-0000-0000-000000000004', 'attended')$$),
  'not_yours',
  'nor one of Dos'
);
select is(
  pg_temp.hint_of($$select pg_temp.mark('uno', 'a0000000-0000-0000-0000-000000000007', 'cancelled_by_barbershop')$$),
  'status_invalid',
  'Mi agenda only marks attended or no-show (decision B1)'
);
select is(
  pg_temp.hint_of($$select pg_temp.mark('cinco', 'a0000000-0000-0000-0000-000000000007', 'attended')$$),
  'not_professional',
  'a professional without an account marks nothing'
);
select is(
  pg_temp.hint_of($q$select pg_temp.mark('uno', 'a0000000-0000-0000-0000-000000000005', 'attended')$q$),
  'not_yours',
  'nor one of another barbershop'
);
select is(
  pg_temp.hint_of($q$select pg_temp.mark('uno', 'a0000000-0000-0000-0000-000000000009', 'no_show')$q$),
  'not_yours',
  'nor one older than a week (decision B5)'
);

-- Blocks --------------------------------------------------------------------------------------------------

-- Task 7.4: only open time is blocked. The next days are made working days
-- whatever the calendar says: Uno goes back to the barbershop's hours (every
-- day, 6:00 to 22:00), and the barbershop opens the ones that are holidays.
reset role;
update public.barbers set uses_barbershop_hours = true
where id = 'ba000000-0000-0000-0000-000000000001';
insert into public.holiday_openings (barbershop_id, holiday_date)
select 'aaaaaaaa-0000-0000-0000-000000000001', pg_temp.d(n)
from generate_series(0, 8) n
where private.is_colombian_holiday(pg_temp.d(n));
set local role authenticated;

select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(1, '16:00'), pg_temp.at(1, '17:00'), 'Diligencia')$$),
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
set local role authenticated;
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(1, '10:15'), pg_temp.at(1, '11:00'), null)$$),
  'overlaps_appointment',
  'not over an appointment of their own'
);
select is(
  pg_temp.hint_of($q$select pg_temp.block('uno', pg_temp.at(1, '14:30'), pg_temp.at(1, '15:30'), null)$q$),
  'overlaps_block',
  'nor over a block of their own'
);
select is(
  pg_temp.hint_of($q$select pg_temp.block('uno', pg_temp.at(1, '18:00'), pg_temp.at(1, '19:00'), 'Llama al 3001234567')$q$),
  'range_invalid',
  'only the reasons of B-04'
);
select is(
  pg_temp.hint_of($q$select pg_temp.block('uno', pg_temp.at(1, '18:00') + interval '400 milliseconds', pg_temp.at(1, '19:00'), null)$q$),
  'range_invalid',
  'exactly on the quarter hour, not a fraction of a second off'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(1, '10:05'), pg_temp.at(1, '10:20'), null)$$),
  'range_invalid',
  'only in steps of 15 minutes'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(1, '23:00'), pg_temp.at(2, '01:00'), null)$$),
  'range_invalid',
  'within one Bogotá day'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(31, '10:00'), pg_temp.at(31, '11:00'), null)$$),
  'range_invalid',
  'up to 30 days ahead (decision B5)'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(-1, '10:00'), pg_temp.at(-1, '11:00'), null)$$),
  'too_early',
  'never in the past'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('cuatro', pg_temp.at(1, '10:00'), pg_temp.at(1, '11:00'), null)$$),
  'barber_inactive',
  'an inactive barber does not block'
);
-- Task 7.4: what is already closed is not blocked again.
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(1, '22:00'), pg_temp.at(1, '23:00'), null)$$),
  'already_closed',
  'not outside the hours they work'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(5, '00:00'), pg_temp.at(6, '00:00'), 'Permiso')$$),
  'no error',
  'a whole day, 0:00 to 24:00, is one block'
);
reset role;
-- Dos works one day of the week only; the barbershop closes for everyone
-- the whole day 7 and two hours of the day 8.
update public.barbers set uses_barbershop_hours = false
where id = 'ba000000-0000-0000-0000-000000000002';
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002',
        extract(dow from pg_temp.d(3))::int, '09:00', '19:00');
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000001', null, pg_temp.at(7, '06:00'), pg_temp.at(7, '22:00'), 'Inventario'),
  ('aaaaaaaa-0000-0000-0000-000000000001', null, pg_temp.at(8, '12:00'), pg_temp.at(8, '14:00'), 'Reunión');
-- The next holiday the other barbershop does not open, if there is one in
-- the 30 days a block can reach.
create temp table next_holiday as
select min(pg_temp.d(n)) as day
from generate_series(1, 30) n
where private.is_colombian_holiday(pg_temp.d(n));
grant select on next_holiday to authenticated;
set local role authenticated;
select is(
  pg_temp.hint_of($$select pg_temp.block('dos', pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00'), null)$$),
  'already_closed',
  'not on a day they do not work'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(7, '10:00'), pg_temp.at(7, '11:00'), null)$$),
  'already_closed',
  'not over hours the barbershop closed for everyone'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(7, '00:00'), pg_temp.at(8, '00:00'), null)$$),
  'already_closed',
  'nor the whole of a day the barbershop closed'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(8, '13:00'), pg_temp.at(8, '15:00'), null)$$),
  'no error',
  'but a block that reaches into open hours is taken'
);
select case
  when (select day from next_holiday) is null
    then skip('no holiday in the next 30 days', 1)
  else is(
    pg_temp.hint_of(format(
      $f$select pg_temp.block('tres', %L::timestamptz, %L::timestamptz, null)$f$,
      ((select day from next_holiday) + time '10:00') at time zone 'America/Bogota',
      ((select day from next_holiday) + time '11:00') at time zone 'America/Bogota'
    )),
    'already_closed',
    'not on a holiday the barbershop does not open'
  )
end;

select is(
  pg_temp.hint_of($$select pg_temp.unblock('uno', 'b0000000-0000-0000-0000-000000000003')$$),
  'not_yours',
  'the barber does not remove a closure of the whole barbershop'
);
select is(
  pg_temp.hint_of($$select pg_temp.unblock('uno', 'b0000000-0000-0000-0000-000000000002')$$),
  'not_yours',
  'nor a block of Dos'
);
select is(
  pg_temp.hint_of($q$select pg_temp.unblock('uno', 'b0000000-0000-0000-0000-000000000005')$q$),
  'not_yours',
  'nor one of another barbershop'
);
select is(
  pg_temp.hint_of($q$select pg_temp.unblock('uno', 'b0000000-0000-0000-0000-000000000004')$q$),
  'not_yours',
  'nor one that already ended'
);
select is(
  pg_temp.hint_of($$select pg_temp.unblock('uno', 'b0000000-0000-0000-0000-000000000001')$$),
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
set local role authenticated;

select is(
  (pg_temp.agenda('uno', pg_temp.d(0), pg_temp.d(0))) #> '{barbershop,writable}',
  'false'::jsonb,
  'the agenda says it is read only (B-06)'
);
select is(
  pg_temp.hint_of($$select pg_temp.mark('uno', 'a0000000-0000-0000-0000-000000000007', 'no_show')$$),
  'no error',
  'a suspended barbershop still lets the barber mark a no-show'
);
select is(
  pg_temp.hint_of($$select pg_temp.block('uno', pg_temp.at(1, '18:00'), pg_temp.at(1, '19:00'), null)$$),
  'read_only',
  'but not block'
);
select is(
  pg_temp.hint_of($$select pg_temp.unblock('uno', (select id from public.time_blocks where false))$$),
  'read_only',
  'nor remove a block'
);

-- A deleted barbershop: its professionals' sessions reach nothing.
reset role;
update public.barbershops set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002';
set local role authenticated;
select is(pg_temp.agenda('tres', pg_temp.d(0), pg_temp.d(0)), null,
  'the session of a professional of a deleted barbershop gives nothing');

select * from finish();
rollback;
