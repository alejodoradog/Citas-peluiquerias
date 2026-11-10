-- History of appointment changes: who changed what and when. Written only by
-- a trigger, so no code path can change an appointment without leaving a trace.
-- See docs/decisiones/0006-esquema-base-de-datos-final.md.

-- service_added / service_removed: lines of appointment_services changed after
-- the appointment was created (change_appointment_services).
create type public.appointment_event_type as enum (
  'status_changed', 'rescheduled', 'service_added', 'service_removed'
);

-- staff: a signed-in account (owner today; phase 2 roles too).
-- customer / barber: link functions (tasks 3.4 and 4.4) that set yapoin.actor.
-- system: server jobs (service_role) and anything else without a session.
create type public.event_actor as enum ('staff', 'customer', 'barber', 'system');

create table public.appointment_events (
  id bigint generated always as identity primary key,
  barbershop_id uuid not null,
  appointment_id uuid not null,
  type public.appointment_event_type not null,
  actor public.event_actor not null,
  -- If the account is deleted, the event stays and loses the link.
  actor_user_id uuid references public.profiles (id) on delete set null,
  old_status public.appointment_status,
  new_status public.appointment_status,
  old_barber_id uuid,
  new_barber_id uuid,
  old_starts_at timestamptz,
  new_starts_at timestamptz,
  old_ends_at timestamptz,
  new_ends_at timestamptz,
  -- For service_added / service_removed. No FK: it is history.
  service_id uuid,
  created_at timestamptz not null default now(),
  foreign key (barbershop_id, appointment_id)
    references public.appointments (barbershop_id, id) on delete restrict
);

create index appointment_events_appointment_idx
  on public.appointment_events (barbershop_id, appointment_id, created_at);

create index appointment_events_actor_user_idx
  on public.appointment_events (actor_user_id)
  where actor_user_id is not null;

alter table public.appointment_events enable row level security;

-- Who is changing an appointment right now. A session always wins over the
-- setting, so a signed-in user cannot pose as a customer or a barber. Link
-- functions (3.4, 4.4) run without a session and set yapoin.actor (local).
create function private.current_actor()
returns public.event_actor
language sql
stable
set search_path = ''
as $$
  select case
    when auth.uid() is not null then 'staff'
    when current_setting('yapoin.actor', true) = 'customer' then 'customer'
    when current_setting('yapoin.actor', true) = 'barber' then 'barber'
    else 'system'
  end::public.event_actor
$$;

create function private.log_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  who public.event_actor := private.current_actor();
begin

  if new.status is distinct from old.status then
    insert into public.appointment_events (
      barbershop_id, appointment_id, type, actor, actor_user_id,
      old_status, new_status
    ) values (
      new.barbershop_id, new.id, 'status_changed', who, caller,
      old.status, new.status
    );
  end if;

  if new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.barber_id is distinct from old.barber_id then
    insert into public.appointment_events (
      barbershop_id, appointment_id, type, actor, actor_user_id,
      old_barber_id, new_barber_id, old_starts_at, new_starts_at,
      old_ends_at, new_ends_at
    ) values (
      new.barbershop_id, new.id, 'rescheduled', who, caller,
      old.barber_id, new.barber_id, old.starts_at, new.starts_at,
      old.ends_at, new.ends_at
    );
  end if;

  return null;
end;
$$;

create trigger log_appointment_event
  after update of status, starts_at, ends_at, barber_id on public.appointments
  for each row execute function private.log_appointment_event();

-- Read only, for members and the super admin. Nobody writes from the API.
grant select on public.appointment_events to authenticated;

create policy member_read on public.appointment_events
  for select to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));
create policy super_admin_read on public.appointment_events
  for select to authenticated
  using ((select private.is_super_admin()));
