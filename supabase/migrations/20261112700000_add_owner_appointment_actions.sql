-- Task 4.2 (docs/tareas/4.2-detalle-cita.md): what the owner does with an
-- appointment from the panel (D-34 to D-39).
--
-- Security definer functions for the members of a barbershop (never anon).
-- Each one checks the barbershop with private.member_barbershop_ids(), so a
-- member of A never reaches B, not even by naming its ids; what they do not
-- reach is not_found, the same as what does not exist. They reuse the rules
-- of the public booking (3.3) and take its lock per barbershop and Bogotá
-- day (and the day before, in order, as the barber's blocks of 4.4), so a
-- web booking, a block of a barber and an action of the owner see each
-- other. yapoin.actor stays unset: the history records staff and auth.uid().
--
-- - create_manual_appointment: a chosen customer, or a new one with only the
--   name (an email that already exists books for that customer and never
--   changes it, as in 3.3). An active barber who offers every service, inside
--   their hours, with no block or appointment in between; from the current
--   quarter hour (a walk-in; no minimum notice, decision A4 of 4.1) to 30
--   days ahead; a holiday is closed unless the barbershop opens it.
-- - reschedule_appointment: a confirmed appointment keeps its duration and
--   moves to a barber who offers its services, with the same rules; it never
--   clashes with itself (decision M1: services change with the next one).
-- - change_appointment_services_checked: change_appointment_services plus,
--   for the services it adds, active ones the barber offers; the ones it
--   keeps keep their line (price and length, decision M11). 480 minutes at
--   most and, while the appointment has not started, its hours and blocks
--   (decision M5: once in the chair, adding the beard is what happened).
-- - set_appointment_status: attended or no_show once it started, and
--   corrected between them (founder, 2026-11-12); cancelled_by_barbershop
--   while confirmed, at any time (spec: "La barbería puede cancelar
--   siempre"). A cancelled appointment does not come back (decision M3).
-- - create_time_block: a barber or the whole barbershop (null), one Bogotá
--   day in steps of 15 minutes, from the current quarter hour to 30 days
--   ahead, the reasons of D-39 and no appointment in between ("Reprográmala
--   o cancélala primero").
-- - delete_time_block: a block that has not ended.
--
-- Errors carry a hint the app maps (src/modulos/agenda/datos/owner-appointment-errors.ts).

-- 1. Helpers ---------------------------------------------------------------------------------------

-- The caller is a member of a barbershop that exists and is not deleted.
create function private.owner_reaches(p_barbershop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_barbershop_id is not null
    and p_barbershop_id = any (private.member_barbershop_ids())
    and exists (
      select 1 from public.barbershops b
      where b.id = p_barbershop_id and b.deleted_at is null
    )
$$;

-- The lock of a public booking of that barbershop and Bogotá day, and the
-- day before first: a booking takes the lock of the day it starts and may
-- run past midnight. Always in ascending order, so two never wait on each
-- other.
create function private.lock_booking_day(p_barbershop_id uuid, p_day date)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(
    hashtextextended('book_appointment:' || p_barbershop_id::text || ':' || (p_day - 1)::text, 0)
  );
  select pg_advisory_xact_lock(
    hashtextextended('book_appointment:' || p_barbershop_id::text || ':' || p_day::text, 0)
  );
$$;

-- When the owner may start an appointment of p_minutes: null, or the hint.
create function private.owner_time_problem(
  p_barbershop_id uuid,
  p_starts_at timestamptz,
  p_minutes integer
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_starts_at is null or p_minutes is null or p_minutes not between 5 and 480 then 'slot_invalid'
    -- Quarter hours of the clock, no seconds (fractions included). Bogotá
    -- is a whole number of hours from UTC.
    when p_starts_at <> date_bin('15 minutes', p_starts_at, timestamptz '2000-01-01 00:00+00') then 'slot_invalid'
    when p_starts_at < date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00+00') then 'too_early'
    when (p_starts_at at time zone 'America/Bogota')::date
      > private.today_bogota() + private.booking_window_days() then 'outside_booking_window'
    when private.is_colombian_holiday((p_starts_at at time zone 'America/Bogota')::date)
      and not exists (
        select 1 from public.holiday_openings h
        where h.barbershop_id = p_barbershop_id
          and h.holiday_date = (p_starts_at at time zone 'America/Bogota')::date
      ) then 'closed'
    else null
  end
$$;

-- Whether a barber may take [p_starts_at, p_ends_at): null, or the hint. As
-- private.barber_slot_problem (3.3), leaving out one appointment, the one
-- that moves.
create function private.owner_slot_problem(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_except uuid
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when not exists (
      select 1
      from private.barber_open_spans(
        p_barbershop_id, p_barber_id, (p_starts_at at time zone 'America/Bogota')::date
      ) sp
      where sp.starts_at <= p_starts_at and p_ends_at <= sp.ends_at
    ) then 'outside_hours'
    when exists (
      select 1
      from public.time_blocks tb
      where tb.barbershop_id = p_barbershop_id
        and (tb.barber_id is null or tb.barber_id = p_barber_id)
        and tb.starts_at < p_ends_at
        and p_starts_at < tb.ends_at
    ) then 'blocked'
    when exists (
      select 1
      from public.appointments a
      where a.barber_id = p_barber_id
        and a.id is distinct from p_except
        and a.status in ('confirmed', 'attended', 'no_show')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ) then 'slot_taken'
    else null
  end
$$;

-- The barber of the barbershop: barber_not_found, barber_inactive, or
-- barber_does_not_offer_service for any of p_service_ids.
create function private.check_owner_barber(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  is_active boolean;
begin
  select br.active into is_active
  from public.barbers br
  where br.barbershop_id = p_barbershop_id
    and br.id = p_barber_id;
  if not found then
    raise exception 'unknown barber'
      using errcode = 'P0002', hint = 'barber_not_found';
  end if;
  if not is_active then
    raise exception 'barber is inactive'
      using errcode = 'P0001', hint = 'barber_inactive';
  end if;
  if exists (
    select 1
    from unnest(p_service_ids) as t (sid)
    where not exists (
      select 1 from public.barber_services bs
      where bs.barbershop_id = p_barbershop_id
        and bs.barber_id = p_barber_id
        and bs.service_id = t.sid
    )
  ) then
    raise exception 'the barber does not offer every service'
      using errcode = 'P0001', hint = 'barber_does_not_offer_service';
  end if;
end;
$$;

-- The total minutes of 1 to 5 distinct active services of the barbershop:
-- services_required, services_repeated, service_inactive or too_long.
create function private.owner_services_minutes(p_barbershop_id uuid, p_service_ids uuid[])
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  found_services integer;
  total_minutes integer;
begin
  if coalesce(cardinality(p_service_ids), 0) not between 1 and 5
    or array_position(p_service_ids, null) is not null then
    raise exception 'between 1 and 5 services'
      using errcode = 'invalid_parameter_value', hint = 'services_required';
  end if;
  if (select count(distinct sid) from unnest(p_service_ids) as t (sid)) <> cardinality(p_service_ids) then
    raise exception 'repeated service'
      using errcode = 'invalid_parameter_value', hint = 'services_repeated';
  end if;
  select count(*), sum(s.duration_minutes)
  into found_services, total_minutes
  from public.services s
  where s.barbershop_id = p_barbershop_id
    and s.id = any (p_service_ids)
    and s.active;
  if found_services <> cardinality(p_service_ids) then
    raise exception 'service is inactive or unknown'
      using errcode = 'invalid_parameter_value', hint = 'service_inactive';
  end if;
  if total_minutes > 480 then
    raise exception 'appointment longer than 480 minutes'
      using errcode = 'invalid_parameter_value', hint = 'too_long';
  end if;
  return total_minutes;
end;
$$;

revoke all on function private.owner_reaches(uuid) from public;
revoke all on function private.lock_booking_day(uuid, date) from public;
revoke all on function private.owner_time_problem(uuid, timestamptz, integer) from public;
revoke all on function private.owner_slot_problem(uuid, uuid, timestamptz, timestamptz, uuid) from public;
revoke all on function private.check_owner_barber(uuid, uuid, uuid[]) from public;
revoke all on function private.owner_services_minutes(uuid, uuid[]) from public;

-- 2. create_manual_appointment (D-38) --------------------------------------------------------------

create function public.create_manual_appointment(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz,
  p_service_ids uuid[],
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_phone text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  customer_name text := btrim(p_customer_name);
  customer_email text := nullif(lower(btrim(p_customer_email)), '');
  customer_phone text := nullif(btrim(p_customer_phone), '');
  total_minutes integer;
  problem text;
  found_customer uuid;
  new_id uuid;
begin
  if not private.owner_reaches(p_barbershop_id) then
    raise exception 'unknown barbershop'
      using errcode = 'P0002', hint = 'not_found';
  end if;

  -- A new customer: the name, and an email and a phone only if given.
  if p_customer_id is null then
    if customer_name is null or char_length(customer_name) not between 1 and 100
      or customer_name ~ '[[:cntrl:]]' then
      raise exception 'name of 1 to 100 characters'
        using errcode = 'invalid_parameter_value', hint = 'customer_name_invalid';
    end if;
    if customer_email is not null and not private.is_email(customer_email) then
      raise exception 'valid email'
        using errcode = 'invalid_parameter_value', hint = 'customer_email_invalid';
    end if;
    if customer_phone is not null and not (
      private.is_e164_phone(customer_phone) and customer_phone ~ '^\+573[0-9]{9}$'
    ) then
      raise exception 'Colombian mobile in E.164'
        using errcode = 'invalid_parameter_value', hint = 'customer_phone_invalid';
    end if;
  end if;

  total_minutes := private.owner_services_minutes(p_barbershop_id, p_service_ids);
  perform private.check_owner_barber(p_barbershop_id, p_barber_id, p_service_ids);

  problem := private.owner_time_problem(p_barbershop_id, p_starts_at, total_minutes);
  if problem is not null then
    raise exception 'the time cannot be booked'
      using errcode = 'P0001', hint = problem;
  end if;

  perform private.lock_booking_day(p_barbershop_id, (p_starts_at at time zone 'America/Bogota')::date);

  problem := private.owner_slot_problem(
    p_barbershop_id, p_barber_id, p_starts_at,
    p_starts_at + make_interval(mins => total_minutes), null
  );
  if problem is not null then
    raise exception 'the time cannot be booked'
      using errcode = 'P0001', hint = problem;
  end if;

  if p_customer_id is not null then
    select c.id into found_customer
    from public.customers c
    where c.barbershop_id = p_barbershop_id
      and c.id = p_customer_id
      and c.anonymized_at is null;
    if found_customer is null then
      raise exception 'unknown customer'
        using errcode = 'P0002', hint = 'customer_not_found';
    end if;
  elsif customer_email is not null then
    -- By email, never changed (3.3).
    insert into public.customers (barbershop_id, full_name, email, phone)
    values (p_barbershop_id, customer_name, customer_email, customer_phone)
    on conflict (barbershop_id, email) do nothing
    returning id into found_customer;
    if found_customer is null then
      select c.id into found_customer
      from public.customers c
      where c.barbershop_id = p_barbershop_id
        and c.email = customer_email;
    end if;
  else
    insert into public.customers (barbershop_id, full_name, phone)
    values (p_barbershop_id, customer_name, customer_phone)
    returning id into found_customer;
  end if;

  begin
    new_id := public.create_appointment(
      p_barbershop_id, found_customer, p_barber_id, p_starts_at, p_service_ids, 'manual', null
    );
  exception
    when exclusion_violation then
      raise exception 'the time was taken'
        using errcode = 'P0001', hint = 'slot_taken';
  end;
  return new_id;
end;
$$;

-- 3. reschedule_appointment (D-37) -----------------------------------------------------------------

create function public.reschedule_appointment(
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

-- 4. change_appointment_services_checked (the pencil of D-34) -----------------------------------------

create function public.change_appointment_services_checked(
  p_appointment_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  appt record;
  total_minutes integer;
  kept_minutes integer;
  new_minutes integer;
  new_count integer;
  new_ids uuid[];
  problem text;
begin
  select a.id, a.barbershop_id, a.barber_id, a.status, a.starts_at into appt
  from public.appointments a
  where a.id = p_appointment_id
    and private.owner_reaches(a.barbershop_id)
  for update;
  if not found then
    raise exception 'unknown appointment'
      using errcode = 'P0002', hint = 'not_found';
  end if;
  if appt.status not in ('confirmed', 'attended') then
    raise exception 'only confirmed or attended appointments'
      using errcode = 'check_violation', hint = 'appointment_closed';
  end if;

  if coalesce(cardinality(p_service_ids), 0) not between 1 and 5
    or array_position(p_service_ids, null) is not null then
    raise exception 'between 1 and 5 services'
      using errcode = 'invalid_parameter_value', hint = 'services_required';
  end if;
  if (select count(distinct sid) from unnest(p_service_ids) as t (sid)) <> cardinality(p_service_ids) then
    raise exception 'repeated service'
      using errcode = 'invalid_parameter_value', hint = 'services_repeated';
  end if;

  -- A service the appointment keeps keeps its line: its price and length
  -- (change_appointment_services never edits a line), even if it was
  -- deactivated since (decision M11). Only the new ones are checked: active
  -- services of this barbershop that the barber offers.
  select coalesce(sum(l.duration_minutes), 0) into kept_minutes
  from public.appointment_services l
  where l.barbershop_id = appt.barbershop_id
    and l.appointment_id = appt.id
    and l.service_id = any (p_service_ids);
  select coalesce(array_agg(t.sid), '{}') into new_ids
  from unnest(p_service_ids) as t (sid)
  where not exists (
    select 1 from public.appointment_services l
    where l.barbershop_id = appt.barbershop_id
      and l.appointment_id = appt.id
      and l.service_id = t.sid
  );
  select count(*), coalesce(sum(sv.duration_minutes), 0)
  into new_count, new_minutes
  from public.services sv
  where sv.barbershop_id = appt.barbershop_id
    and sv.id = any (new_ids)
    and sv.active;
  if new_count <> cardinality(new_ids) then
    raise exception 'service is inactive or unknown'
      using errcode = 'invalid_parameter_value', hint = 'service_inactive';
  end if;
  if exists (
    select 1
    from unnest(new_ids) as t (sid)
    where not exists (
      select 1 from public.barber_services bs
      where bs.barbershop_id = appt.barbershop_id
        and bs.barber_id = appt.barber_id
        and bs.service_id = t.sid
    )
  ) then
    raise exception 'the barber does not offer every service'
      using errcode = 'P0001', hint = 'barber_does_not_offer_service';
  end if;
  -- The length change_appointment_services will give the appointment.
  total_minutes := kept_minutes + new_minutes;
  if total_minutes > 480 then
    raise exception 'appointment longer than 480 minutes'
      using errcode = 'invalid_parameter_value', hint = 'too_long';
  end if;

  -- Not started yet: the new length is a booking decision (decision M5).
  if appt.status = 'confirmed' and appt.starts_at > now() then
    perform private.lock_booking_day(appt.barbershop_id, (appt.starts_at at time zone 'America/Bogota')::date);
    problem := private.owner_slot_problem(
      appt.barbershop_id, appt.barber_id, appt.starts_at,
      appt.starts_at + make_interval(mins => total_minutes), appt.id
    );
    if problem is not null then
      raise exception 'the services do not fit'
        using errcode = 'P0001', hint = problem;
    end if;
  end if;

  begin
    perform public.change_appointment_services(appt.id, p_service_ids);
  exception
    when exclusion_violation then
      raise exception 'the time was taken'
        using errcode = 'P0001', hint = 'slot_taken';
  end;
end;
$$;

-- 5. set_appointment_status (D-35 and D-36) ---------------------------------------------------------

create function public.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  appt record;
begin
  select a.id, a.status, a.starts_at into appt
  from public.appointments a
  where a.id = p_appointment_id
    and private.owner_reaches(a.barbershop_id)
  for update;
  if not found then
    raise exception 'unknown appointment'
      using errcode = 'P0002', hint = 'not_found';
  end if;

  if p_status in ('attended', 'no_show') then
    if appt.status not in ('confirmed', 'attended', 'no_show') then
      raise exception 'a cancelled appointment is not marked'
        using errcode = 'P0001', hint = 'not_confirmed';
    end if;
    if appt.starts_at > now() then
      raise exception 'the appointment has not started'
        using errcode = 'P0001', hint = 'not_started';
    end if;
  elsif p_status = 'cancelled_by_barbershop' then
    if appt.status <> 'confirmed' then
      raise exception 'only confirmed appointments are cancelled'
        using errcode = 'P0001', hint = 'not_confirmed';
    end if;
  else
    raise exception 'the panel sets attended, no_show or cancelled_by_barbershop'
      using errcode = 'invalid_parameter_value', hint = 'status_invalid';
  end if;

  if appt.status <> p_status then
    update public.appointments set status = p_status where id = appt.id;
  end if;
end;
$$;

-- 6. create_time_block (D-39) -----------------------------------------------------------------------

create function public.create_time_block(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  is_active boolean;
  block_day date;
  new_id uuid;
begin
  if not private.owner_reaches(p_barbershop_id) then
    raise exception 'unknown barbershop'
      using errcode = 'P0002', hint = 'not_found';
  end if;
  if p_barber_id is not null then
    select br.active into is_active
    from public.barbers br
    where br.barbershop_id = p_barbershop_id
      and br.id = p_barber_id;
    if not found then
      raise exception 'unknown barber'
        using errcode = 'P0002', hint = 'barber_not_found';
    end if;
    if not is_active then
      raise exception 'barber is inactive'
        using errcode = 'P0001', hint = 'barber_inactive';
    end if;
  end if;

  -- The reasons of D-39, as the agenda shows them; "Otro" is none.
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at
    or (p_reason is not null and p_reason not in ('Almuerzo', 'Permiso', 'Diligencia')) then
    raise exception 'invalid block'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;
  if p_starts_at < date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00+00') then
    raise exception 'the block starts in the past'
      using errcode = 'P0001', hint = 'too_early';
  end if;
  block_day := (p_starts_at at time zone 'America/Bogota')::date;
  if p_starts_at <> date_bin('15 minutes', p_starts_at, timestamptz '2000-01-01 00:00+00')
    or p_ends_at <> date_bin('15 minutes', p_ends_at, timestamptz '2000-01-01 00:00+00')
    or p_ends_at > (block_day + 1)::timestamp at time zone 'America/Bogota'
    or block_day > private.today_bogota() + private.booking_window_days() then
    raise exception 'one day, in steps of 15 minutes, up to 30 days ahead'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;

  perform private.lock_booking_day(p_barbershop_id, block_day);

  if exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and (p_barber_id is null or a.barber_id = p_barber_id)
      and a.status in ('confirmed', 'attended', 'no_show')
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'there is an appointment in between'
      using errcode = 'P0001', hint = 'overlaps_appointment';
  end if;
  if exists (
    select 1
    from public.time_blocks t
    where t.barbershop_id = p_barbershop_id
      and (t.barber_id is null or t.barber_id is not distinct from p_barber_id)
      and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'there is a block in between'
      using errcode = 'P0001', hint = 'overlaps_block';
  end if;

  insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
  values (p_barbershop_id, p_barber_id, p_starts_at, p_ends_at, p_reason)
  returning id into new_id;
  return new_id;
end;
$$;

-- 7. delete_time_block (the sheet of a block in the agenda) ---------------------------------------------

create function public.delete_time_block(p_block_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  block record;
begin
  select t.id, t.ends_at into block
  from public.time_blocks t
  where t.id = p_block_id
    and private.owner_reaches(t.barbershop_id)
  for update;
  if not found then
    raise exception 'unknown block'
      using errcode = 'P0002', hint = 'not_found';
  end if;
  if block.ends_at <= now() then
    raise exception 'the block ended'
      using errcode = 'P0001', hint = 'block_ended';
  end if;
  delete from public.time_blocks where id = block.id;
end;
$$;

-- 8. Privileges ----------------------------------------------------------------------------------------

revoke all on function public.create_manual_appointment(uuid, uuid, timestamptz, uuid[], uuid, text, text, text) from public;
revoke all on function public.reschedule_appointment(uuid, uuid, timestamptz) from public;
revoke all on function public.change_appointment_services_checked(uuid, uuid[]) from public;
revoke all on function public.set_appointment_status(uuid, public.appointment_status) from public;
revoke all on function public.create_time_block(uuid, uuid, timestamptz, timestamptz, text) from public;
revoke all on function public.delete_time_block(uuid) from public;

grant execute on function public.create_manual_appointment(uuid, uuid, timestamptz, uuid[], uuid, text, text, text) to authenticated;
grant execute on function public.reschedule_appointment(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.change_appointment_services_checked(uuid, uuid[]) to authenticated;
grant execute on function public.set_appointment_status(uuid, public.appointment_status) to authenticated;
grant execute on function public.create_time_block(uuid, uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.delete_time_block(uuid) to authenticated;
