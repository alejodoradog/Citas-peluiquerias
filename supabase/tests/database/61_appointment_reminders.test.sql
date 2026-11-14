-- Task 5.3, migration add_appointment_reminders: the reminder and the emails
-- of the appointments.
--
-- - A new appointment queues the customer's reminder (24 h before, 3 h before
--   when there is no time for that, at once when not even that) and the
--   barber's notice, only for a customer with an email and a barber who
--   asked for notices.
-- - Moved: a new reminder, and the customer's notice only when the
--   barbershop moved it. Cancelled: the barber's notice, and the customer's
--   only when the barbershop cancelled it.
-- - The links of the emails reach the appointment like the one of C-08; only
--   the server key keeps them, never in a table a session reads.
-- - "Confirmo" saves the answer; a new time asks again.
-- - A barbershop name never carries a link.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

-- Fixtures, inserted as the table owner -------------------------------------------------------
-- Barbershop R (owner r). Uno takes notices, Dos does not. Camila has an
-- email; Mario (a manual appointment) does not.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000061aa', 'owner-r@example.com');
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000061', 'Barbería R', 'recordatorio-r', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-0000000061aa', 'Dueño R', '+573001112233');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-0000000061aa', 'aaaaaaaa-0000-0000-0000-000000000061', 'owner');
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000061', 'aaaaaaaa-0000-0000-0000-000000000061', 'Corte', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, email, email_notifications, sort_order) values
  ('ba000000-0000-0000-0000-000000000061', 'aaaaaaaa-0000-0000-0000-000000000061', 'Uno',
   encode(sha256(convert_to('Uno recordatorio', 'UTF8')), 'hex'), 'uno@example.com', true, 1),
  ('ba000000-0000-0000-0000-000000000062', 'aaaaaaaa-0000-0000-0000-000000000061', 'Dos',
   encode(sha256(convert_to('Dos recordatorio', 'UTF8')), 'hex'), 'dos@example.com', false, 2);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000061', 'ba000000-0000-0000-0000-000000000061', '5e000000-0000-0000-0000-000000000061'),
  ('aaaaaaaa-0000-0000-0000-000000000061', 'ba000000-0000-0000-0000-000000000062', '5e000000-0000-0000-0000-000000000061');
insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-000000000061', 'aaaaaaaa-0000-0000-0000-000000000061', 'Camila Rojas', 'camila@example.com'),
  ('c0000000-0000-0000-0000-000000000062', 'aaaaaaaa-0000-0000-0000-000000000061', 'Mario Sin Correo', null);

-- An appointment of Camila with Uno, `starts` from now, with its link of C-08.
create function pg_temp.book(appointment uuid, starts interval, customer uuid, barber uuid, source text)
returns uuid
language sql
as $$
  insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, manage_token_hash)
  values (appointment, 'aaaaaaaa-0000-0000-0000-000000000061', customer, barber,
          now() + starts, now() + starts + interval '30 minutes', 25000, source::public.appointment_source,
          case when source = 'web' then encode(sha256(convert_to('c08 ' || appointment, 'UTF8')), 'hex') end)
  returning id
$$;

-- The messages queued for an appointment, as "type@minutes from now" (the
-- minutes until it is due, rounded), in order.
create function pg_temp.queued(appointment uuid)
returns text[]
language sql
as $$
  select array_agg(n.type || '@' || round(extract(epoch from (n.scheduled_for - now())) / 60)
                   order by n.type, n.scheduled_for)
  from public.notifications n
  where n.appointment_id = appointment
$$;

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
  if sqlstate = '42501' then
    return sqlstate;
  end if;
  get stacked diagnostics error_hint = pg_exception_hint;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;
grant execute on function pg_temp.hint_of(text) to anon, authenticated, service_role;

-- Structure and privileges -------------------------------------------------------------------

select has_column('public', 'appointments', 'customer_confirmed_at', 'an appointment keeps the customer''s answer');
select ok(
  has_column_privilege('authenticated', 'public.appointments', 'customer_confirmed_at', 'SELECT')
    and not has_column_privilege('authenticated', 'public.appointments', 'customer_confirmed_at', 'UPDATE'),
  'the owner reads the answer and never writes it'
);
select ok(
  not has_table_privilege('anon', 'private.appointment_links', 'SELECT')
    and not has_table_privilege('authenticated', 'private.appointment_links', 'SELECT')
    and not has_table_privilege('service_role', 'private.appointment_links', 'SELECT'),
  'nobody reads the links of the emails'
);
select ok(
  has_function_privilege('service_role', 'public.issue_appointment_link(uuid, uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.issue_appointment_link(uuid, uuid, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.issue_appointment_link(uuid, uuid, text)', 'EXECUTE'),
  'only the server key keeps a link'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.issue_appointment_link(uuid, uuid, text)'::regprocedure,
     'public.confirm_appointment_by_token(text)'::regprocedure,
     'public.managed_appointment(text)'::regprocedure,
     'private.queue_appointment_emails()'::regprocedure
   )),
  'the new functions are security definer with an empty search_path'
);

-- A new appointment ------------------------------------------------------------------------------

select pg_temp.book('e0000000-0000-0000-0000-000000000611', interval '2 days', 'c0000000-0000-0000-0000-000000000061', 'ba000000-0000-0000-0000-000000000061', 'web');
select is(
  pg_temp.queued('e0000000-0000-0000-0000-000000000611'),
  array['appointment_reminder@1440', 'barber_new_booking@0'],
  'a booking two days ahead: the reminder 24 h before, the barber''s notice now'
);
select is(
  (select payload ->> 'starts_at' from public.notifications
   where appointment_id = 'e0000000-0000-0000-0000-000000000611' and type = 'appointment_reminder')::timestamptz,
  (select starts_at from public.appointments where id = 'e0000000-0000-0000-0000-000000000611'),
  'the payload keeps only the start it was queued for'
);
select is(
  (select count(*)::int from public.notifications
   where appointment_id = 'e0000000-0000-0000-0000-000000000611'
     and payload::text ~* '(camila|@|token|c08)'),
  0, 'and nothing personal or secret'
);

select pg_temp.book('e0000000-0000-0000-0000-000000000612', interval '10 hours', 'c0000000-0000-0000-0000-000000000061', 'ba000000-0000-0000-0000-000000000062', 'web');
select is(
  pg_temp.queued('e0000000-0000-0000-0000-000000000612'),
  array['appointment_reminder@420'],
  'ten hours ahead: the reminder 3 h before, and no notice for a barber who did not ask'
);

select pg_temp.book('e0000000-0000-0000-0000-000000000613', interval '1 hour', 'c0000000-0000-0000-0000-000000000061', 'ba000000-0000-0000-0000-000000000062', 'web');
select is(
  pg_temp.queued('e0000000-0000-0000-0000-000000000613'),
  array['appointment_reminder@0'],
  'one hour ahead: the reminder at once, as its confirmation'
);

select pg_temp.book('e0000000-0000-0000-0000-000000000614', interval '2 days', 'c0000000-0000-0000-0000-000000000062', 'ba000000-0000-0000-0000-000000000062', 'manual');
select is(
  pg_temp.queued('e0000000-0000-0000-0000-000000000614'),
  null,
  'a manual appointment without an email queues nothing for the customer'
);

-- Moved -------------------------------------------------------------------------------------------

-- The customer moves it from their link.
select set_config('yapoin.actor', 'customer', true);
update public.appointments set customer_confirmed_at = now() where id = 'e0000000-0000-0000-0000-000000000611';
update public.appointments
set starts_at = now() + interval '3 days', ends_at = now() + interval '3 days 30 minutes'
where id = 'e0000000-0000-0000-0000-000000000611';
select is(
  pg_temp.queued('e0000000-0000-0000-0000-000000000611'),
  array['appointment_reminder@1440', 'appointment_reminder@2880', 'barber_new_booking@0'],
  'moved by the customer: a new reminder for the new time, and no other email'
);
select is(
  (select customer_confirmed_at from public.appointments where id = 'e0000000-0000-0000-0000-000000000611'),
  null, 'a new time asks for the answer again'
);
select set_config('yapoin.actor', '', true);

-- The owner moves it, to Dos.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000061aa", "role": "authenticated"}';
update public.appointments
set starts_at = now() + interval '4 days', ends_at = now() + interval '4 days 30 minutes',
    barber_id = 'ba000000-0000-0000-0000-000000000062'
where id = 'e0000000-0000-0000-0000-000000000611';
select is(
  (select count(*)::int from public.notifications
   where appointment_id = 'e0000000-0000-0000-0000-000000000611' and type = 'appointment_rescheduled'),
  1, 'moved by the barbershop: the customer is told'
);
select is(
  (select (payload ->> 'old_starts_at')::timestamptz > now() + interval '2 days 23 hours'
   from public.notifications
   where appointment_id = 'e0000000-0000-0000-0000-000000000611' and type = 'appointment_rescheduled'),
  true, 'with the old time, to say from when to when'
);
select is(
  (select count(*)::int from public.notifications
   where appointment_id = 'e0000000-0000-0000-0000-000000000611' and type = 'barber_new_booking'),
  1, 'and Dos, who asked for no notices, is not told'
);

-- Cancelled -----------------------------------------------------------------------------------------

-- The barbershop cancels the appointment of Camila with Uno (ten hours ahead, then moved to Uno).
update public.appointments set barber_id = 'ba000000-0000-0000-0000-000000000061'
where id = 'e0000000-0000-0000-0000-000000000612';
update public.appointments set status = 'cancelled_by_barbershop'
where id = 'e0000000-0000-0000-0000-000000000612';
select ok(
  (select array['appointment_cancelled', 'barber_booking_cancelled'] <@ array_agg(type::text)
   from public.notifications where appointment_id = 'e0000000-0000-0000-0000-000000000612'),
  'cancelled by the barbershop: the customer and the barber are told'
);
reset request.jwt.claims;

-- The customer cancels from the link of C-08 (the appointment is now with Dos).
set local role anon;
select is(
  pg_temp.hint_of($$select public.cancel_appointment_by_token(encode(sha256(convert_to('c08 e0000000-0000-0000-0000-000000000611', 'UTF8')), 'hex'))$$),
  'no error', 'the customer cancels from their link'
);
reset role;
select is(
  (select array_agg(type::text order by type) from public.notifications
   where appointment_id = 'e0000000-0000-0000-0000-000000000611' and type in ('appointment_cancelled', 'barber_booking_cancelled')),
  null,
  'cancelled by the customer: nobody is told (Dos asked for no notices)'
);

-- The links of the emails ---------------------------------------------------------------------------

set local role service_role;
select is(
  pg_temp.hint_of($$select public.issue_appointment_link('aaaaaaaa-0000-0000-0000-000000000061', 'e0000000-0000-0000-0000-000000000614',
    encode(sha256(convert_to('correo 1', 'UTF8')), 'hex'))$$),
  'no error', 'the server key keeps the hash of an email''s link'
);
select is(
  pg_temp.hint_of($$select public.issue_appointment_link('aaaaaaaa-0000-0000-0000-000000000061', 'e0000000-0000-0000-0000-000000000614',
    encode(sha256(convert_to('correo 1', 'UTF8')), 'hex'))$$),
  'no error', 'the same link twice is a retry'
);
select is(
  pg_temp.hint_of($$select public.issue_appointment_link(gen_random_uuid(), 'e0000000-0000-0000-0000-000000000614',
    encode(sha256(convert_to('correo 2', 'UTF8')), 'hex'))$$),
  'P0002', 'never for an appointment of another barbershop'
);
select is(
  pg_temp.hint_of($$select public.issue_appointment_link('aaaaaaaa-0000-0000-0000-000000000061', 'e0000000-0000-0000-0000-000000000614', 'not a hash')$$),
  '22023', 'nor with something that is not a hash'
);
reset role;

set local role anon;
select is(
  (select row(customer_first_name, customer_confirmed)::text
   from public.managed_appointment(encode(sha256(convert_to('correo 1', 'UTF8')), 'hex'))),
  '(Mario,f)',
  'the email''s link opens the appointment, like the one of C-08'
);
select is(
  pg_temp.hint_of($$select public.confirm_appointment_by_token(encode(sha256(convert_to('correo 1', 'UTF8')), 'hex'))$$),
  'no error', '"Confirmo" from the email''s link'
);
select is(
  (select customer_confirmed from public.managed_appointment(encode(sha256(convert_to('correo 1', 'UTF8')), 'hex'))),
  true, 'and the appointment says so'
);
select is(
  pg_temp.hint_of($$select public.confirm_appointment_by_token(encode(sha256(convert_to('correo 1', 'UTF8')), 'hex'))$$),
  'no error', 'tapping it twice changes nothing'
);
select is(
  pg_temp.hint_of($$select public.confirm_appointment_by_token(encode(sha256(convert_to('c08 e0000000-0000-0000-0000-000000000611', 'UTF8')), 'hex'))$$),
  'link_invalid', 'a cancelled appointment is not confirmed'
);
select is(
  pg_temp.hint_of($$select public.cancel_appointment_by_token(encode(sha256(convert_to('correo 1', 'UTF8')), 'hex'))$$),
  'no error', 'and the email''s link also cancels'
);
reset role;

-- A barbershop name without links -------------------------------------------------------------------

select is(
  pg_temp.hint_of($$update public.barbershops set name = 'Paga en http://falso.co' where id = 'aaaaaaaa-0000-0000-0000-000000000061'$$),
  '23514', 'a barbershop name never carries a link'
);
select is(
  pg_temp.hint_of($$update public.barbershops set name = 'Visita www.falso.co' where id = 'aaaaaaaa-0000-0000-0000-000000000061'$$),
  '23514', 'nor a www. address'
);

select * from finish();
rollback;
