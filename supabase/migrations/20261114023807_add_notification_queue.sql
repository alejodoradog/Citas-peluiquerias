-- Task 5.1: the email queue is worked every minute, and a message goes out
-- once even if two runs overlap (decision 0007, points 6 and 8; criterion of
-- its checklist: "a test email goes out once, even if the job runs twice").
--
-- How it flows:
-- 1. Something worth an email calls private.enqueue_notification. The
--    dedupe_key of the message makes a second call a no-op.
-- 2. Every minute pg_cron runs private.request_notification_send: if a
--    message is due, it calls the Edge Function send-notifications through
--    pg_net, with the URL and the secret kept in Vault. Without them (local,
--    CI) or with nothing due, it calls nothing.
-- 3. The function takes up to 50 due messages with claim_notifications:
--    for update skip locked, plus a lease of 5 minutes with its own id, so two
--    runs never take the same message and a run that dies hands it back.
-- 4. It sends each one and reports with finish_notification, with the lease
--    id: sent, retried later (up to 3 attempts) or cancelled (nobody to send
--    it to). A report whose lease expired or was taken over changes nothing.
--
-- The provider (decision 0008, a proposal: Resend instead of SES) lives only
-- in the Edge Function. Nothing here depends on it.

-- 1. Three columns --------------------------------------------------------------------
-- payload: what the message needs that the database cannot rebuild later,
-- such as the old time of a rescheduled appointment. Contract: never a
-- secret (a manage link, a token) nor personal data (a name, an email); the
-- recipient and the details are read when the message is sent.
-- locked_until and lease_id: the lease of the run that took the message.

alter table public.notifications
  add column payload jsonb not null default '{}'::jsonb
    constraint notifications_payload_is_object check (jsonb_typeof(payload) = 'object'),
  add column locked_until timestamptz,
  add column lease_id uuid;

-- A session (the super admin, decision 0002) reads the state of the queue,
-- never its payload or its errors.
revoke select on public.notifications from authenticated;
grant select (id, barbershop_id, appointment_id, type, scheduled_for, sent_at, status,
              attempts, dedupe_key, created_at, updated_at)
  on public.notifications to authenticated;

-- The index of due messages also serves the lease filter.
drop index public.notifications_pending_idx;
create index notifications_pending_idx
  on public.notifications (scheduled_for, locked_until)
  where status = 'pending';

-- 2. Enqueue (the contract for tasks 5.2, 5.3 and 5.5) -----------------------------------
-- Called from security definer functions and triggers, never by a session.
-- Returns the id of the new message, or null if that dedupe_key was already
-- queued (the message is not queued twice).

create function private.enqueue_notification(
  p_barbershop_id uuid,
  p_type public.notification_type,
  p_dedupe_key text,
  p_appointment_id uuid default null,
  p_scheduled_for timestamptz default now(),
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.notifications (
    barbershop_id, appointment_id, type, scheduled_for, dedupe_key, payload
  ) values (
    p_barbershop_id, p_appointment_id, p_type, p_scheduled_for, p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (barbershop_id, dedupe_key) do nothing
  returning id;
$$;

revoke all on function private.enqueue_notification(uuid, public.notification_type, text, uuid, timestamptz, jsonb) from public;

-- 3. Who receives a message ----------------------------------------------------------------
-- Resolved when it is sent, so a customer deleted in between (task 4.3) gets
-- nothing. Null means nobody: the message is cancelled.
-- - The customer's messages: their email, if they have one.
-- - The barber's: their email, if they asked for the notices and are active.
-- - The subscription's: the email of the barbershop's first owner.

create function private.notification_recipient(p_notification_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when n.type in ('appointment_confirmed', 'appointment_reminder',
                    'appointment_cancelled', 'appointment_rescheduled') then (
      select c.email
      from public.appointments a
      join public.customers c on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
      where a.barbershop_id = n.barbershop_id and a.id = n.appointment_id
        and c.anonymized_at is null
    )
    when n.type in ('barber_new_booking', 'barber_booking_cancelled') then (
      select b.email
      from public.appointments a
      join public.barbers b on b.barbershop_id = a.barbershop_id and b.id = a.barber_id
      where a.barbershop_id = n.barbershop_id and a.id = n.appointment_id
        and b.email_notifications
        and b.active
    )
    else (
      select u.email::text
      from public.memberships m
      join auth.users u on u.id = m.user_id
      where m.barbershop_id = n.barbershop_id and m.role = 'owner'
      order by m.created_at, m.user_id
      limit 1
    )
  end
  from public.notifications n
  where n.id = p_notification_id;
$$;

revoke all on function private.notification_recipient(uuid) from public;

-- 4. Claim and finish (only the server key: the Edge Function) ------------------------------

create function public.claim_notifications(p_limit integer default 50)
returns table (
  id uuid,
  lease_id uuid,
  barbershop_id uuid,
  appointment_id uuid,
  type public.notification_type,
  payload jsonb,
  attempts integer,
  recipient text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select n.id
    from public.notifications n
    where n.status = 'pending'
      and n.scheduled_for <= now()
      and (n.locked_until is null or n.locked_until <= now())
    order by n.scheduled_for, n.id
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  ),
  taken as (
    update public.notifications n
    set locked_until = now() + interval '5 minutes',
        lease_id = gen_random_uuid(),
        attempts = n.attempts + 1
    from due
    where n.id = due.id
    returning n.id, n.lease_id, n.barbershop_id, n.appointment_id, n.type, n.payload, n.attempts
  )
  select t.id, t.lease_id, t.barbershop_id, t.appointment_id, t.type, t.payload, t.attempts,
         private.notification_recipient(t.id)
  from taken t
  order by t.id;
end;
$$;

-- p_outcome: 'sent', 'retry' (a failure worth trying again) or 'cancelled'
-- (nobody to send it to, or the provider refused the address for good). A
-- retry waits 5 minutes per attempt made, and the third failure is final.
-- Only the run that holds the lease, before it expires, finishes the message:
-- a late report, or one about a lease another run took over, changes
-- nothing. p_error is a short code (timeout, bounced, http_500), never the
-- provider's text, which may carry the address.
create function public.finish_notification(
  p_notification_id uuid,
  p_lease_id uuid,
  p_outcome text,
  p_error text default null
)
returns public.notification_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  msg record;
  next_status public.notification_status;
begin
  if p_outcome not in ('sent', 'retry', 'cancelled') then
    raise exception 'unknown outcome'
      using errcode = 'P0001', hint = 'outcome_invalid';
  end if;

  select n.id, n.status, n.attempts into msg
  from public.notifications n
  where n.id = p_notification_id
    and n.status = 'pending'
    and n.lease_id = p_lease_id
    and n.locked_until > now()
  for update;
  if not found then
    return null;
  end if;

  next_status := case
    when p_outcome = 'sent' then 'sent'
    when p_outcome = 'cancelled' then 'cancelled'
    when msg.attempts >= 3 then 'failed'
    else 'pending'
  end;

  update public.notifications n
  set status = next_status,
      sent_at = case when next_status = 'sent' then now() end,
      locked_until = null,
      lease_id = null,
      last_error = case when p_outcome = 'sent' then null else left(p_error, 100) end,
      scheduled_for = case
        when next_status = 'pending' then now() + make_interval(mins => 5 * msg.attempts)
        else n.scheduled_for
      end
  where n.id = msg.id;

  return next_status;
end;
$$;

revoke all on function public.claim_notifications(integer) from public;
revoke all on function public.finish_notification(uuid, uuid, text, text) from public;
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.finish_notification(uuid, uuid, text, text) to service_role;

-- 5. Every minute, call the Edge Function if something is due ---------------------------------
-- The URL (https://<project>.supabase.co/functions/v1/send-notifications) and
-- the secret the function checks live in Vault, set by hand in each project:
--   select vault.create_secret('<url>', 'notifications_function_url');
--   select vault.create_secret('<secret>', 'notifications_secret');
-- Returns the pg_net request id, or null when it called nothing.

create extension if not exists pg_net with schema extensions;

create function private.request_notification_send()
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  function_url text;
  function_secret text;
begin
  if not exists (
    select 1
    from public.notifications n
    where n.status = 'pending'
      and n.scheduled_for <= now()
      and (n.locked_until is null or n.locked_until <= now())
  ) then
    return null;
  end if;

  select s.decrypted_secret into function_url
  from vault.decrypted_secrets s where s.name = 'notifications_function_url';
  select s.decrypted_secret into function_secret
  from vault.decrypted_secrets s where s.name = 'notifications_secret';
  if function_url is null or function_secret is null then
    return null;
  end if;

  return net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || function_secret
    ),
    body := '{}'::jsonb,
    -- The function answers at once and works the batch in the background.
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function private.request_notification_send() from public;

select cron.schedule(
  'send-notifications',
  '* * * * *',
  $$select private.request_notification_send()$$
);
