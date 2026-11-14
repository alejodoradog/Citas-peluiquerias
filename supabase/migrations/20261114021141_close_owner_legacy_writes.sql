-- Task 4.2b: the owner's session changes appointments, their lines and a
-- barber's blocks only through the functions of task 4.2, which check hours,
-- blocks, the booking window and the states. Until now the old paths of
-- decision 0006 (task 1.9) stayed open: create_appointment and
-- change_appointment_services with the owner's token, and direct writes to
-- appointments, appointment_services and time_blocks. They only let an owner
-- skip the rules inside their own barbershop (RLS and the exclusion
-- constraint still held), but the rules are the point of task 4.2.
--
-- Also the founder's decision of 2026-11-13 (M9 of docs/tareas/4.2): an
-- appointment that already started does not move. A customer who missed it
-- books again.
--
-- What keeps working, untouched:
-- - the functions of task 4.2 (create_manual_appointment,
--   change_appointment_services_checked, reschedule_appointment,
--   set_appointment_status, create_time_block, delete_time_block), the public
--   booking (book_appointment_from_app), the customer's link (task 3.4) and
--   the barber's link (task 4.4). All are security definer: they call
--   create_appointment and change_appointment_services as their owner, not
--   as the caller.
-- - the closures of the whole barbershop (D-59, barber_id null), which span
--   several days and are written directly by design (docs/tareas/4.2,
--   "Riesgos conocidos").

-- 1. The old functions -------------------------------------------------------------
-- Server jobs and the e2e seeds keep create_appointment with the server key.

revoke execute on function public.create_appointment(uuid, uuid, uuid, timestamptz, uuid[], public.appointment_source, text) from authenticated;
revoke execute on function public.change_appointment_services(uuid, uuid[]) from authenticated;
grant execute on function public.create_appointment(uuid, uuid, uuid, timestamptz, uuid[], public.appointment_source, text) to service_role;

-- 2. appointments: read only for the session --------------------------------------
-- The column grants of 20261109042517 survive a table-level revoke, so they
-- are revoked by name.

revoke insert on public.appointments from authenticated;
revoke update (customer_id, barber_id, starts_at, ends_at, price_cop, status, deposit_received)
  on public.appointments from authenticated;
revoke update on public.appointments from authenticated;
drop policy member_insert on public.appointments;
drop policy member_update on public.appointments;

-- 3. appointment_services: read only for the session ------------------------------

revoke insert, delete on public.appointment_services from authenticated;
revoke update (position) on public.appointment_services from authenticated;
revoke update on public.appointment_services from authenticated;
drop policy member_insert on public.appointment_services;
drop policy member_update on public.appointment_services;
drop policy member_delete on public.appointment_services;

-- 4. time_blocks: directly, only the closures of the whole barbershop -------------
-- A barber's block goes through create_time_block and delete_time_block. No
-- one edits a block in place: it is deleted and made again.

revoke update on public.time_blocks from authenticated;
drop policy member_update on public.time_blocks;

drop policy member_insert on public.time_blocks;
create policy member_insert on public.time_blocks
  for insert to authenticated
  with check (
    barbershop_id = any ((select private.member_barbershop_ids())::uuid[])
    and barber_id is null
  );

drop policy member_delete on public.time_blocks;
create policy member_delete on public.time_blocks
  for delete to authenticated
  using (
    barbershop_id = any ((select private.member_barbershop_ids())::uuid[])
    and barber_id is null
  );

-- 5. reschedule_appointment: an appointment that started does not move ------------
-- Same body as 20261112700000, plus the check after not_confirmed.

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  appt record;
  service_ids uuid[];
  total_minutes integer;
  problem text;
begin
  select a.id, a.barbershop_id, a.status, a.starts_at, a.ends_at into appt
  from public.appointments a
  where a.id = p_appointment_id
    and private.owner_reaches(a.barbershop_id)
  for update;
  if not found then
    raise exception 'unknown appointment'
      using errcode = 'P0002', hint = 'not_found';
  end if;
  if appt.status <> 'confirmed' then
    raise exception 'only confirmed appointments move'
      using errcode = 'P0001', hint = 'not_confirmed';
  end if;
  if appt.starts_at <= now() then
    raise exception 'an appointment that started does not move'
      using errcode = 'P0001', hint = 'already_started';
  end if;

  select coalesce(array_agg(l.service_id order by l.position), '{}') into service_ids
  from public.appointment_services l
  where l.barbershop_id = appt.barbershop_id
    and l.appointment_id = appt.id;
  perform private.check_owner_barber(appt.barbershop_id, p_barber_id, service_ids);

  total_minutes := (extract(epoch from appt.ends_at - appt.starts_at) / 60)::integer;
  problem := private.owner_time_problem(appt.barbershop_id, p_starts_at, total_minutes);
  if problem is not null then
    raise exception 'the time cannot be booked'
      using errcode = 'P0001', hint = problem;
  end if;

  perform private.lock_booking_day(appt.barbershop_id, (p_starts_at at time zone 'America/Bogota')::date);

  problem := private.owner_slot_problem(
    appt.barbershop_id, p_barber_id, p_starts_at,
    p_starts_at + make_interval(mins => total_minutes), appt.id
  );
  if problem is not null then
    raise exception 'the time cannot be booked'
      using errcode = 'P0001', hint = problem;
  end if;

  begin
    update public.appointments
    set barber_id = p_barber_id,
        starts_at = p_starts_at,
        ends_at = p_starts_at + make_interval(mins => total_minutes)
    where id = appt.id;
  exception
    when exclusion_violation then
      raise exception 'the time was taken'
        using errcode = 'P0001', hint = 'slot_taken';
  end;
end;
$$;
