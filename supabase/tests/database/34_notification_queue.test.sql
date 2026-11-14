-- Task 5.1, migrations add_notification_retention (migration 11 of decision
-- 0006) and add_notification_queue: the email queue.
--
-- - Retention: appointment messages point at their appointment and
--   subscription messages do not; finished messages are purged after 90 days,
--   pending ones never; the purge runs every day.
-- - Enqueue: one message per dedupe_key, however many calls.
-- - Claim: only due messages, at most the limit, and a message taken by one
--   run is not taken by another until its lease expires. The recipient is
--   resolved then: nobody for a deleted customer or a barber without notices.
-- - Finish: sent, retried with a growing wait up to 3 attempts, or cancelled;
--   a late report changes nothing.
-- - Every minute pg_cron calls the Edge Function, only if something is due
--   and the URL and the secret are in Vault.
-- - Only the server key claims and finishes; no session reads the queue.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(44);

-- Structure and privileges -------------------------------------------------------------------

select has_column('public', 'notifications', 'payload', 'a message carries a payload');
select has_column('public', 'notifications', 'locked_until', 'and the lease of the run that took it');
select is(
  (select count(*)::int from cron.job where jobname = 'purge-notifications' and schedule = '30 8 * * *'),
  1, 'the purge runs every day at 03:30 in Bogotá'
);
select is(
  (select count(*)::int from cron.job where jobname = 'send-notifications' and schedule = '* * * * *'),
  1, 'and the sender every minute'
);
select ok(
  (select bool_and(has_function_privilege('service_role', f, 'EXECUTE')
      and not has_function_privilege('authenticated', f, 'EXECUTE')
      and not has_function_privilege('anon', f, 'EXECUTE'))
   from unnest(array[
     'public.claim_notifications(integer)',
     'public.finish_notification(uuid, uuid, text, text)'
   ]) f),
  'only the server key claims and finishes messages'
);
select ok(
  (select bool_and(not has_function_privilege('authenticated', f, 'EXECUTE')
      and not has_function_privilege('anon', f, 'EXECUTE'))
   from unnest(array[
     'private.enqueue_notification(uuid, public.notification_type, text, uuid, timestamptz, jsonb)',
     'private.notification_recipient(uuid)',
     'private.request_notification_send()',
     'private.purge_notifications(interval, integer)'
   ]) f),
  'no session enqueues, resolves, calls the sender or purges'
);

-- Fixtures, inserted as the table owner -----------------------------------------------------------
-- Barbershop A (owner a). Uno takes notices, Dos does not. Camila has an
-- email; Diego was deleted (task 4.3). a1: Camila with Uno; a2: Diego with
-- Dos, last week.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com');
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Barbería A', 'cola-a', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner');
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Corte', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, email, email_notifications, sort_order) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Uno',
   encode(sha256(convert_to('Uno cola', 'UTF8')), 'hex'), 'uno@example.com', true, 1),
  ('ba000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dos',
   encode(sha256(convert_to('Dos cola', 'UTF8')), 'hex'), 'dos@example.com', false, 2);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000001');
insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Camila Rojas', 'camila@example.com'),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Diego Prada', 'diego@example.com');
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', now() + interval '2 days', now() + interval '2 days 30 minutes', 25000, 'web'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   'ba000000-0000-0000-0000-000000000002', now() - interval '7 days', now() - interval '7 days' + interval '30 minutes', 25000, 'web');
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, '5e000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 1, '5e000000-0000-0000-0000-000000000001');
update public.customers
set full_name = 'Cliente borrado', email = null, phone = null, notes = null, anonymized_at = now()
where id = 'c0000000-0000-0000-0000-000000000002';

-- The hint of the error a statement raises, its code if it has no hint or is
-- a missing privilege, or 'no error'.
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
  if sqlstate = '42501' then
    return sqlstate;
  end if;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;

grant execute on function pg_temp.hint_of(text) to authenticated;

-- Retention (migration 11) ------------------------------------------------------------------------

select is(
  pg_temp.hint_of($$ insert into public.notifications (barbershop_id, type, scheduled_for, dedupe_key)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'appointment_confirmed', now(), 'sin-cita') $$),
  '23514', 'an appointment message needs its appointment'
);
select is(
  pg_temp.hint_of($$ insert into public.notifications (barbershop_id, appointment_id, type, scheduled_for, dedupe_key)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
              'subscription_expiring', now(), 'con-cita') $$),
  '23514', 'and a subscription message has none'
);

insert into public.notifications (barbershop_id, type, scheduled_for, dedupe_key, status, sent_at, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'subscription_expiring', now() - interval '100 days', 'viejo-enviado',
   'sent', now() - interval '100 days', now() - interval '100 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'subscription_expired', now() - interval '100 days', 'viejo-fallido',
   'failed', null, now() - interval '100 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'subscription_suspended', now() + interval '1 day', 'viejo-pendiente',
   'pending', null, now() - interval '100 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'subscription_payment_registered', now() - interval '10 days', 'reciente',
   'sent', now() - interval '10 days', now() - interval '10 days');

select is(private.purge_notifications(), 2, 'the purge deletes what finished more than 90 days ago');
select results_eq(
  $$ select dedupe_key from public.notifications order by dedupe_key $$,
  $$ values ('reciente'), ('viejo-pendiente') $$,
  'and keeps what is recent or still pending'
);
delete from public.notifications;

-- Enqueue ----------------------------------------------------------------------------------------

create temp table ids (name text primary key, id uuid);

-- The lease a message holds now.
create function pg_temp.lease(message_name text)
returns uuid
language sql
stable
as $$
  select n.lease_id from public.notifications n
  where n.id = (select ids.id from pg_temp.ids where ids.name = message_name)
$$;

insert into ids values ('cliente', private.enqueue_notification(
  'aaaaaaaa-0000-0000-0000-000000000001', 'appointment_confirmed', 'confirmada:e1',
  'e0000000-0000-0000-0000-000000000001', now() - interval '1 minute', '{"manage_url": "https://example.com/c/x"}'
));
select isnt((select id from ids where name = 'cliente'), null, 'a message is queued');
select is(
  private.enqueue_notification(
    'aaaaaaaa-0000-0000-0000-000000000001', 'appointment_confirmed', 'confirmada:e1',
    'e0000000-0000-0000-0000-000000000001'
  ),
  null, 'the same dedupe_key again queues nothing'
);
select is(
  (select count(*)::int from public.notifications where dedupe_key = 'confirmada:e1'),
  1, 'so the message is there once'
);
select is(
  (select payload->>'manage_url' from public.notifications where id = (select id from ids where name = 'cliente')),
  'https://example.com/c/x', 'with its payload'
);

insert into ids values
  ('barbero', private.enqueue_notification(
    'aaaaaaaa-0000-0000-0000-000000000001', 'barber_new_booking', 'barbero:e1',
    'e0000000-0000-0000-0000-000000000001', now() - interval '1 minute')),
  ('sin-avisos', private.enqueue_notification(
    'aaaaaaaa-0000-0000-0000-000000000001', 'barber_new_booking', 'barbero:e2',
    'e0000000-0000-0000-0000-000000000002', now() - interval '1 minute')),
  ('borrado', private.enqueue_notification(
    'aaaaaaaa-0000-0000-0000-000000000001', 'appointment_cancelled', 'cancelada:e2',
    'e0000000-0000-0000-0000-000000000002', now() - interval '1 minute')),
  ('dueno', private.enqueue_notification(
    'aaaaaaaa-0000-0000-0000-000000000001', 'subscription_expiring', 'vence:2026-11-30',
    null, now() - interval '1 minute')),
  ('futuro', private.enqueue_notification(
    'aaaaaaaa-0000-0000-0000-000000000001', 'appointment_reminder', 'recordatorio:e1',
    'e0000000-0000-0000-0000-000000000001', now() + interval '1 day'));

-- The sender call, before anything is in Vault -----------------------------------------------------

select is(private.request_notification_send(), null, 'without the URL and the secret in Vault, nothing is called');

-- Claim ----------------------------------------------------------------------------------------

create temp table first_run as select * from public.claim_notifications(3);
create temp table second_run as select * from public.claim_notifications(50);

select is((select count(*)::int from first_run), 3, 'a run takes at most its limit');
select is((select count(*)::int from second_run), 2, 'a second run takes the rest of what is due');
select is(
  (select count(*)::int from first_run f join second_run s using (id)),
  0, 'and never a message the first one holds'
);
select is(
  (select count(*)::int from public.claim_notifications(50)),
  0, 'a third run finds nothing: every due message is held'
);
select ok(
  not exists (select 1 from first_run where id = (select id from ids where name = 'futuro'))
  and not exists (select 1 from second_run where id = (select id from ids where name = 'futuro')),
  'a message scheduled for later is not taken'
);
select is(
  (select attempts from public.notifications where id = (select id from ids where name = 'cliente')),
  1, 'taking a message counts an attempt'
);

create temp table taken as select * from first_run union all select * from second_run;

select is((select recipient from taken where id = (select id from ids where name = 'cliente')),
  'camila@example.com', 'the customer receives her messages');
select is((select recipient from taken where id = (select id from ids where name = 'barbero')),
  'uno@example.com', 'the barber who takes notices receives his');
select is((select recipient from taken where id = (select id from ids where name = 'sin-avisos')),
  null, 'a barber without notices receives nothing');
select is((select recipient from taken where id = (select id from ids where name = 'borrado')),
  null, 'nor does a deleted customer');
select is((select recipient from taken where id = (select id from ids where name = 'dueno')),
  'owner-a@example.com', 'the subscription messages go to the owner');
update public.barbers set active = false where id = 'ba000000-0000-0000-0000-000000000001';
select is(private.notification_recipient((select id from ids where name = 'barbero')),
  null, 'a barber who left receives nothing, even with the notices on');
update public.barbers set active = true where id = 'ba000000-0000-0000-0000-000000000001';

-- Finish -----------------------------------------------------------------------------------------

select is(
  public.finish_notification((select id from ids where name = 'cliente'), pg_temp.lease('cliente'), 'sent'),
  'sent'::public.notification_status, 'a sent message is marked sent'
);
select results_eq(
  $$ select status::text, sent_at is not null, locked_until is null from public.notifications
     where id = (select id from ids where name = 'cliente') $$,
  $$ values ('sent', true, true) $$,
  'with when it went out, and its lease released'
);
select is(
  public.finish_notification((select id from ids where name = 'cliente'), pg_temp.lease('cliente'), 'retry', 'tarde'),
  null, 'a late report of a finished message changes nothing'
);

select is(
  public.finish_notification((select id from ids where name = 'barbero'), pg_temp.lease('barbero'), 'retry', 'timeout'),
  'pending'::public.notification_status, 'a failure is tried again'
);
select results_eq(
  $$ select last_error, locked_until is null,
            scheduled_for between now() + interval '4 minutes' and now() + interval '6 minutes'
     from public.notifications where id = (select id from ids where name = 'barbero') $$,
  $$ values ('timeout'::text, true, true) $$,
  'five minutes later, keeping the error'
);
update public.notifications set scheduled_for = now() - interval '1 second', attempts = 2
where id = (select id from ids where name = 'barbero');
select is(
  (select count(*)::int from public.claim_notifications(50) c where c.id = (select id from ids where name = 'barbero')),
  1, 'when the wait is over it is taken again'
);
select is(
  public.finish_notification((select id from ids where name = 'barbero'), pg_temp.lease('barbero'), 'retry', 'timeout'),
  'failed'::public.notification_status, 'and the third failure is final'
);

select is(
  public.finish_notification((select id from ids where name = 'sin-avisos'), pg_temp.lease('sin-avisos'), 'cancelled', 'no recipient'),
  'cancelled'::public.notification_status, 'a message with nobody to receive it is cancelled'
);
select is(
  pg_temp.hint_of($$ select public.finish_notification((select id from ids where name = 'dueno'), pg_temp.lease('dueno'), 'perdido') $$),
  'outcome_invalid', 'an unknown outcome is refused'
);

create temp table old_lease as select pg_temp.lease('dueno') as id;
update public.notifications set locked_until = now() - interval '1 second'
where id = (select id from ids where name = 'dueno');
select is(
  (select count(*)::int from public.claim_notifications(50) c where c.id = (select id from ids where name = 'dueno')),
  1, 'a message whose lease expired (its run died) is taken again'
);
select is(
  public.finish_notification((select id from ids where name = 'dueno'), (select id from old_lease), 'retry', 'timeout'),
  null, 'and the slow run that lost it cannot finish it'
);

-- The sender call -------------------------------------------------------------------------------

select vault.create_secret('http://127.0.0.1:9/functions/v1/send-notifications', 'notifications_function_url');
select vault.create_secret('secreto-de-prueba', 'notifications_secret');
update public.notifications set locked_until = null where id = (select id from ids where name = 'borrado');
select isnt(private.request_notification_send(), null, 'with them in Vault and a message due, the function is called');
update public.notifications set status = 'cancelled', locked_until = null where status = 'pending' and scheduled_for <= now();
select is(private.request_notification_send(), null, 'and with nothing due, it is not');

-- No session reads the queue ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is_empty($$ select id from public.notifications $$, 'the owner does not read the queue');
select is(
  pg_temp.hint_of($$ select * from public.claim_notifications(50) $$),
  '42501', 'nor claims it'
);

-- The super admin reads the state of the queue, never its payload or errors.
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
insert into public.profiles (id, full_name, is_super_admin) values ('00000000-0000-0000-0000-0000000000ad', 'Admin', true);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select isnt_empty($$ select id, status, attempts from public.notifications $$, 'the super admin sees the state of the queue');
select is(
  pg_temp.hint_of($$ select payload, last_error from public.notifications $$),
  '42501', 'but not the payload nor the errors'
);

reset role;

select * from finish();
rollback;
