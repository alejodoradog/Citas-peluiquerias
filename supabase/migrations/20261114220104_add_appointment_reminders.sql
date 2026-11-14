-- Task 5.3 (docs/tareas/5.3-recordatorio.md): the reminder and the emails of
-- the appointments, on the queue of task 5.1.
--
-- 1. What is queued, by triggers on appointments, so every path counts (the
--    public booking, the manual appointment, the owner, the customer's link
--    and the barber):
--    - a new appointment: the customer's reminder (the only email the
--      customer gets for it, founder's decision of 2026-11-14) and the
--      barber's notice;
--    - cancelled: the barber's notice, and the customer's only when the
--      barbershop cancelled it;
--    - moved (time or barber): a new reminder, and the customer's notice only
--      when the barbershop moved it.
--    The payload keeps the start the email was queued for, nothing personal
--    (rule Q5 of task 5.1): an email whose appointment changed since is
--    cancelled when it is sent (send-notifications, appointment-emails.ts).
-- 2. The link of the emails. The Edge Function derives each email's token
--    from its id (an HMAC, so a retry gives the same link) and keeps only its
--    hash here, in private.appointment_links. The link of C-08
--    (manage_token_hash) and those of the emails all reach the same
--    appointment.
-- 3. "Confirmo": the customer says they are coming
--    (appointments.customer_confirmed_at), from the link, with one tap. A new
--    time asks again.
-- 4. A barbershop name never carries a link, so an email can never say "Paga
--    en http://…" in a barbershop's name (security note of task 5.2).

-- 1. The customer's answer ------------------------------------------------------------------------

alter table public.appointments add column customer_confirmed_at timestamptz;

grant select (customer_confirmed_at) on public.appointments to authenticated;

-- A new time needs a new answer.
create function private.reset_customer_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.customer_confirmed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.reset_customer_confirmation() from public;

create trigger reset_customer_confirmation
  before update of starts_at on public.appointments
  for each row execute function private.reset_customer_confirmation();

-- 2. The links of the emails ----------------------------------------------------------------------

create table private.appointment_links (
  token_hash text primary key check (private.is_token_hash(token_hash)),
  barbershop_id uuid not null,
  appointment_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (barbershop_id, appointment_id)
    references public.appointments (barbershop_id, id) on delete cascade
);

create index appointment_links_appointment_idx
  on private.appointment_links (barbershop_id, appointment_id);

alter table private.appointment_links enable row level security;
revoke all on private.appointment_links from public, anon, authenticated, service_role;

-- The appointment behind a link: the one of C-08 or one of the emails.
create function private.appointment_id_by_token(p_token_hash text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.id from public.appointments a where a.manage_token_hash = p_token_hash),
    (select l.appointment_id from private.appointment_links l where l.token_hash = p_token_hash)
  )
  where private.is_token_hash(p_token_hash)
$$;

revoke all on function private.appointment_id_by_token(text) from public;

-- The Edge Function keeps the hash of an email's link before sending it. Only
-- for an appointment of that barbershop; the same hash twice is a retry.
create function public.issue_appointment_link(
  p_barbershop_id uuid,
  p_appointment_id uuid,
  p_token_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_token_hash(p_token_hash) then
    raise exception 'not a token hash' using errcode = 'invalid_parameter_value';
  end if;
  insert into private.appointment_links (token_hash, barbershop_id, appointment_id)
  select p_token_hash, a.barbershop_id, a.id
  from public.appointments a
  where a.barbershop_id = p_barbershop_id and a.id = p_appointment_id
  on conflict (token_hash) do nothing;
  if not found and not exists (
    select 1 from private.appointment_links l
    where l.token_hash = p_token_hash
      and l.barbershop_id = p_barbershop_id
      and l.appointment_id = p_appointment_id
  ) then
    raise exception 'appointment not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.issue_appointment_link(uuid, uuid, text) from public;
grant execute on function public.issue_appointment_link(uuid, uuid, text) to service_role;

-- managed_appointment (task 3.4), reached by any of the appointment's links,
-- and now saying whether the customer already confirmed.
drop function public.managed_appointment(text);

create function public.managed_appointment(p_token_hash text)
returns table (
  barbershop_id uuid,
  slug text,
  starts_at timestamptz,
  ends_at timestamptz,
  price_cop integer,
  barber_id uuid,
  barber_name text,
  service_names text[],
  customer_first_name text,
  cancellation_notice_hours integer,
  changeable boolean,
  customer_confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.barbershop_id,
    b.slug,
    a.starts_at,
    a.ends_at,
    a.price_cop,
    a.barber_id,
    br.display_name,
    array(
      select s.name
      from public.appointment_services l
      join public.services s
        on s.barbershop_id = l.barbershop_id and s.id = l.service_id
      where l.barbershop_id = a.barbershop_id
        and l.appointment_id = a.id
      order by l.position
    ),
    split_part(btrim(c.full_name), ' ', 1),
    b.cancellation_notice_hours,
    now() <= a.starts_at - make_interval(hours => b.cancellation_notice_hours),
    a.customer_confirmed_at is not null
  from public.appointments a
  join public.barbershops b on b.id = a.barbershop_id
  join public.barbers br on br.barbershop_id = a.barbershop_id and br.id = a.barber_id
  join public.customers c on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
  where a.id = private.appointment_id_by_token(p_token_hash)
    and a.status = 'confirmed'
    and a.starts_at > now()
    and b.deleted_at is null
$$;

revoke all on function public.managed_appointment(text) from public;
grant execute on function public.managed_appointment(text) to anon, authenticated;

-- The changes of task 3.4, reached by any of the appointment's links.
create or replace function private.lock_managed_appointment(p_token_hash text)
returns public.appointments
language plpgsql
volatile
set search_path = ''
as $$
declare
  found_appointment public.appointments;
  notice_hours integer;
begin
  if p_token_hash is null or not private.is_token_hash(p_token_hash) then
    raise exception 'unknown link'
      using errcode = 'P0001', hint = 'link_invalid';
  end if;

  select a.* into found_appointment
  from public.appointments a
  where a.id = private.appointment_id_by_token(p_token_hash)
  for update;

  if not found
    or found_appointment.status <> 'confirmed'
    or found_appointment.starts_at <= now() then
    raise exception 'unknown link'
      using errcode = 'P0001', hint = 'link_invalid';
  end if;

  select b.cancellation_notice_hours into notice_hours
  from public.barbershops b
  where b.id = found_appointment.barbershop_id
    and b.deleted_at is null;
  if not found then
    raise exception 'unknown link'
      using errcode = 'P0001', hint = 'link_invalid';
  end if;

  if now() > found_appointment.starts_at - make_interval(hours => notice_hours) then
    raise exception 'past the cancellation notice'
      using errcode = 'P0001', hint = 'too_late';
  end if;

  return found_appointment;
end;
$$;

-- 3. "Confirmo" --------------------------------------------------------------------------------
-- Until the appointment starts, whatever the policy's hours: saying "I am
-- coming" never hurts the barbershop.
create function public.confirm_appointment_by_token(p_token_hash text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform set_config('yapoin.actor', 'customer', true);
  update public.appointments a
  set customer_confirmed_at = coalesce(a.customer_confirmed_at, now())
  from public.barbershops b
  where a.id = private.appointment_id_by_token(p_token_hash)
    and b.id = a.barbershop_id
    and b.deleted_at is null
    and a.status = 'confirmed'
    and a.starts_at > now();
  if not found then
    raise exception 'unknown link'
      using errcode = 'P0001', hint = 'link_invalid';
  end if;
end;
$$;

revoke all on function public.confirm_appointment_by_token(text) from public;
grant execute on function public.confirm_appointment_by_token(text) to anon, authenticated;

-- 1. What is queued ------------------------------------------------------------------------------

-- The reminder 24 h before; 3 h before when there is no time for that (the
-- spec: "24 h antes, o 3 h si la cita es para el mismo día"); at once when
-- there is not even time for that, and then it is also the confirmation.
create function private.reminder_time(p_starts_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_starts_at - interval '24 hours' > now() then p_starts_at - interval '24 hours'
    when p_starts_at - interval '3 hours' > now() then p_starts_at - interval '3 hours'
    else now()
  end
$$;

revoke all on function private.reminder_time(timestamptz) from public;

-- Whether the customer of an appointment has an email (a manual appointment
-- may not), and whether its barber asked for notices.
create function private.customer_has_email(p_barbershop_id uuid, p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.customers c
    where c.barbershop_id = p_barbershop_id and c.id = p_customer_id
      and c.email is not null and c.anonymized_at is null
  )
$$;

create function private.barber_wants_notices(p_barbershop_id uuid, p_barber_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.barbers b
    where b.barbershop_id = p_barbershop_id and b.id = p_barber_id
      and b.email_notifications and b.email is not null and b.active
  )
$$;

revoke all on function private.customer_has_email(uuid, uuid) from public;
revoke all on function private.barber_wants_notices(uuid, uuid) from public;

create function private.queue_appointment_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Every change of an appointment queues under its own key (the moment of
  -- the change), so two moves are two reminders; the email of the older one
  -- is cancelled when it is sent, because the time moved.
  stamp text := extract(epoch from clock_timestamp())::text;
  starts jsonb := jsonb_build_object('starts_at', new.starts_at);
  by_barbershop boolean := private.current_actor() = 'staff';
  customer boolean := private.customer_has_email(new.barbershop_id, new.customer_id);
begin
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' and new.starts_at > now() then
      if customer then
        perform private.enqueue_notification(
          new.barbershop_id, 'appointment_reminder', 'reminder:' || new.id || ':' || stamp,
          new.id, private.reminder_time(new.starts_at), starts);
      end if;
      if private.barber_wants_notices(new.barbershop_id, new.barber_id) then
        perform private.enqueue_notification(
          new.barbershop_id, 'barber_new_booking', 'barber-new:' || new.id || ':' || stamp,
          new.id, now(), starts);
      end if;
    end if;
    return null;
  end if;

  -- Cancelled.
  if old.status = 'confirmed'
    and new.status in ('cancelled_by_customer', 'cancelled_by_barbershop') then
    if private.barber_wants_notices(new.barbershop_id, new.barber_id) then
      perform private.enqueue_notification(
        new.barbershop_id, 'barber_booking_cancelled', 'barber-cancelled:' || new.id,
        new.id, now(), starts);
    end if;
    if new.status = 'cancelled_by_barbershop' and customer and new.starts_at > now() then
      perform private.enqueue_notification(
        new.barbershop_id, 'appointment_cancelled', 'cancelled:' || new.id,
        new.id, now(), starts);
    end if;
    return null;
  end if;

  -- Moved: a new time or another barber.
  if new.status = 'confirmed' and new.starts_at > now()
    and (new.starts_at is distinct from old.starts_at
         or new.barber_id is distinct from old.barber_id) then
    if customer then
      perform private.enqueue_notification(
        new.barbershop_id, 'appointment_reminder', 'reminder:' || new.id || ':' || stamp,
        new.id, private.reminder_time(new.starts_at), starts);
      if by_barbershop then
        perform private.enqueue_notification(
          new.barbershop_id, 'appointment_rescheduled', 'rescheduled:' || new.id || ':' || stamp,
          new.id, now(),
          starts || jsonb_build_object('old_starts_at', old.starts_at));
      end if;
    end if;
    if new.barber_id is distinct from old.barber_id
      and private.barber_wants_notices(new.barbershop_id, new.barber_id) then
      perform private.enqueue_notification(
        new.barbershop_id, 'barber_new_booking', 'barber-new:' || new.id || ':' || stamp,
        new.id, now(), starts);
    end if;
  end if;
  return null;
end;
$$;

revoke all on function private.queue_appointment_emails() from public;

create trigger queue_appointment_emails_on_insert
  after insert on public.appointments
  for each row execute function private.queue_appointment_emails();

create trigger queue_appointment_emails_on_update
  after update of status, starts_at, barber_id on public.appointments
  for each row execute function private.queue_appointment_emails();

-- 4. A barbershop name without links ---------------------------------------------------------------

alter table public.barbershops
  add constraint barbershops_name_without_links
    check (name !~* '(://|www\.)');
