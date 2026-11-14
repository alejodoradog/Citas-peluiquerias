-- Task 5.5 (docs/tareas/5.5-ciclo-suscripcion.md): what a barbershop may do
-- in each phase (private.barbershop_phase). Migration 10 of decision 0006
-- (annex A.10), adapted to what task 4.2b changed since it was written.
-- - active: everything.
-- - awaiting_first_payment (a location created after the company trial): it
--   can be configured, but takes no appointments, web or manual.
-- - suspended or expired: the data stays and is readable. Nothing is created
--   and the configuration does not change. On appointments already booked,
--   only these changes are allowed (founder decisions 4 and 5):
--     staff (panel) or barber (link): confirmed -> attended | no_show
--     customer (link):                confirmed -> cancelled_by_customer
-- The public page takes bookings only in the active phase.
--
-- How it differs from A.10, and why:
-- - barbershop_accepts_bookings is not created: it exists since task 3.3 and
--   also refuses deleted barbershops.
-- - The policies of appointments and appointment_services are not touched:
--   task 4.2b closed every write of the session there. The owner writes them
--   through the functions of task 4.2, which are security definer and skip
--   policies, so the phase is enforced with triggers instead (4 and 5).
-- - time_blocks keeps only the closures of the whole barbershop as direct
--   writes (4.2b); they become "configurable". A barber's block goes through
--   create_time_block / delete_time_block (security definer): a trigger (6).
-- - writable_barbershop_ids and bookable_barbershop_ids leave out super admins
--   (task 1.9, after A.10 was written) and deleted barbershops.

-- 1. Phase helpers -------------------------------------------------------------------

create function private.phase_of(p_barbershop_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.barbershop_phase(
    b.subscription_status, b.plan, b.trial_ends_on, b.expires_on,
    (b.created_at at time zone 'America/Bogota')::date
  )
  from public.barbershops b
  where b.id = p_barbershop_id
$$;

revoke all on function private.phase_of(uuid) from public;

-- The caller's barbershops whose configuration may change.
create function private.writable_barbershop_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.barbershop_id), '{}')
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join public.barbershops b on b.id = m.barbershop_id
  where m.user_id = auth.uid()
    and p.active
    and not p.is_super_admin
    and b.deleted_at is null
    and private.barbershop_phase(
      b.subscription_status, b.plan, b.trial_ends_on, b.expires_on,
      (b.created_at at time zone 'America/Bogota')::date
    ) in ('active', 'awaiting_first_payment')
$$;

-- The caller's barbershops that may take new appointments.
create function private.bookable_barbershop_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.barbershop_id), '{}')
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join public.barbershops b on b.id = m.barbershop_id
  where m.user_id = auth.uid()
    and p.active
    and not p.is_super_admin
    and b.deleted_at is null
    and private.barbershop_phase(
      b.subscription_status, b.plan, b.trial_ends_on, b.expires_on,
      (b.created_at at time zone 'America/Bogota')::date
    ) = 'active'
$$;

revoke all on function private.writable_barbershop_ids() from public;
revoke all on function private.bookable_barbershop_ids() from public;
grant execute on function private.writable_barbershop_ids() to authenticated;
grant execute on function private.bookable_barbershop_ids() to authenticated;

-- 2. Configuration tables: every write needs a writable barbershop ------------------------
-- Reads stay on member_barbershop_ids: a blocked barbershop still sees its data.

do $$
declare
  t text;
begin
  foreach t in array array[
    'barbers', 'services', 'barber_services', 'barber_schedules',
    'barbershop_hours', 'holiday_openings', 'customers'
  ] loop
    execute format('drop policy member_insert on public.%I', t);
    execute format('drop policy member_update on public.%I', t);
    execute format('drop policy member_delete on public.%I', t);
    execute format(
      'create policy member_insert on public.%I for insert to authenticated
         with check (barbershop_id = any ((select private.writable_barbershop_ids())::uuid[]))', t);
    execute format(
      'create policy member_update on public.%I for update to authenticated
         using (barbershop_id = any ((select private.writable_barbershop_ids())::uuid[]))
         with check (barbershop_id = any ((select private.writable_barbershop_ids())::uuid[]))', t);
    execute format(
      'create policy member_delete on public.%I for delete to authenticated
         using (barbershop_id = any ((select private.writable_barbershop_ids())::uuid[]))', t);
  end loop;
end;
$$;

-- The barbershop itself (its profile, hours of the wizard, the commission of
-- task 4.6). deleted_at stays as 20261111030000 left it.
drop policy member_update on public.barbershops;
create policy member_update on public.barbershops
  for update to authenticated
  using (id = any ((select private.writable_barbershop_ids())::uuid[]) and deleted_at is null)
  with check (id = any ((select private.writable_barbershop_ids())::uuid[]) and deleted_at is null);

-- The closures of the whole barbershop, as task 4.2b left them, but writable.
drop policy member_insert on public.time_blocks;
create policy member_insert on public.time_blocks
  for insert to authenticated
  with check (
    barbershop_id = any ((select private.writable_barbershop_ids())::uuid[])
    and barber_id is null
  );
drop policy member_delete on public.time_blocks;
create policy member_delete on public.time_blocks
  for delete to authenticated
  using (
    barbershop_id = any ((select private.writable_barbershop_ids())::uuid[])
    and barber_id is null
    and ends_at > now()
  );

-- 3. Appointments already booked: the changes each actor may make (A.10) ----------------
-- Applies to every actor (panel, links and jobs), not only to sessions.

create function private.limit_updates_when_suspended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who public.event_actor := private.current_actor();
begin
  if private.phase_of(new.barbershop_id) = 'active' then
    return new;
  end if;

  if old.status = 'confirmed'
    and (to_jsonb(new) - 'status' - 'updated_at')
      = (to_jsonb(old) - 'status' - 'updated_at')
    and (
      (who in ('staff', 'barber') and new.status in ('attended', 'no_show'))
      or (who = 'customer' and new.status = 'cancelled_by_customer')
    ) then
    return new;
  end if;

  raise exception 'barbershop is read only'
    using errcode = 'insufficient_privilege', hint = 'barbershop_read_only';
end;
$$;

create trigger limit_updates_when_suspended
  before update on public.appointments
  for each row execute function private.limit_updates_when_suspended();

-- 4. New appointments only in the active phase, by any path ----------------------------
-- The public booking checks it already (barbershop_accepts_bookings); this
-- covers the owner's manual appointment (create_manual_appointment, security
-- definer) and any job.

create function private.require_bookable_barbershop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(private.phase_of(new.barbershop_id), '') <> 'active' then
    raise exception 'barbershop is read only'
      using errcode = 'insufficient_privilege', hint = 'barbershop_read_only';
  end if;
  return new;
end;
$$;

create trigger require_bookable_barbershop
  before insert on public.appointments
  for each row execute function private.require_bookable_barbershop();

-- 5. The services of an appointment change only in the active phase ------------------
-- change_appointment_services_checked (task 4.2) is security definer.

create function private.require_bookable_lines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shop uuid := case when tg_op = 'DELETE' then old.barbershop_id else new.barbershop_id end;
begin
  if coalesce(private.phase_of(shop), '') <> 'active' then
    raise exception 'barbershop is read only'
      using errcode = 'insufficient_privilege', hint = 'barbershop_read_only';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger require_bookable_lines
  before insert or update or delete on public.appointment_services
  for each row execute function private.require_bookable_lines();

-- 6. The owner's blocks follow the configuration (decision S5) -------------------------
-- create_time_block and delete_time_block (task 4.2) are security definer.
-- The barber's link functions (task 4.4) already ask for the active phase.

create function private.require_writable_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shop uuid := case when tg_op = 'DELETE' then old.barbershop_id else new.barbershop_id end;
begin
  if private.current_actor() = 'staff'
    and coalesce(private.phase_of(shop), '') not in ('active', 'awaiting_first_payment') then
    raise exception 'barbershop is read only'
      using errcode = 'insufficient_privilege', hint = 'barbershop_read_only';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger require_writable_block
  before insert or delete on public.time_blocks
  for each row execute function private.require_writable_block();
