-- Task 8.14 (docs/tareas/8.14-bloquear-mi-agenda.md): the owner who attends
-- blocks their own agenda ("Mi agenda") as a professional does, and nothing
-- that is already closed is blocked again.
--
-- 1. private.block_has_open_time: the rule of task 7.4 (block_only_open_time)
--    in one body, for a professional and, new, for the whole establishment.
--    It was written twice (private.create_time_block_of and the link function
--    it replaced); now both owners of a block ask the same question.
--    It is exact: the open time is a multirange (the shifts, cut to the
--    establishment's hours), minus the closures of the whole establishment,
--    intersected with the block. 7.4 looked at the start of each quarter
--    hour, which was right only because every bound is a quarter hour (the
--    hours have checks; a closure the owner writes straight to the table,
--    D-59, has none). With the booking interval of 5 and 10 minutes (tasks
--    7.11 and 8.15) nothing of that changed, because blocks and hours stay in
--    quarter hours, but the rule no longer depends on it.
-- 2. private.create_time_block_of (the professional's, my_* functions): the
--    same body as in add_professional_accounts, with the check in (1).
-- 3. public.create_time_block (the owner's, D-39): same signature, so its
--    grants stay (authenticated only). New:
--    - a block of ONE professional (the owner's own row, is_owner, or another
--      one) is refused with already_closed when nothing of it is open for
--      them, exactly as the professional's own block; and, as theirs, it
--      only clashes with that professional's blocks: a closure of the whole
--      establishment inside it is closed time already (so "Todo el día"
--      works on a day with a closure), not a clash;
--    - a block of the WHOLE establishment (p_barber_id null) is refused with
--      already_closed when the establishment is closed for all of it: a
--      holiday it does not open, outside its hours, or inside its own
--      closures. Its hours, not the shifts of its professionals: a shift can
--      change tomorrow and the closure must still hold (decision 2 of 8.14).
--      It still clashes with another closure (overlaps_block), as before.
--    - a paused establishment is refused right after owner_reaches, with the
--      hint and criterion of the read-only trigger (barbershop_read_only),
--      before any rule of the time can answer first;
--    Everything else stays: the owner's barbershop (owner_reaches), the
--    professional of that barbershop and active, the reasons, the current
--    quarter hour, one Bogotá day in quarter hours, 30 days ahead, the lock
--    of the day and no appointment in between.
--
-- Errors carry a hint the app maps (src/modulos/agenda/datos/owner-appointment-errors.ts).

-- 1. The shared rule --------------------------------------------------------------------------------

-- Whether [p_starts_at, p_ends_at), inside one Bogotá day, has time that is
-- open: for a professional (p_barber_id), their open spans of that day
-- (private.barber_open_spans: their shifts cut to the establishment's hours,
-- nothing when inactive); for the whole establishment (null), its hours.
-- Never on a holiday the establishment does not open, and never what it
-- already closed for everyone (its blocks without professional).
--
-- Security invoker and without grants: only the security definer functions
-- below call it, as their owner, after checking who calls.
create function private.block_has_open_time(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  with day as (
    select (p_starts_at at time zone 'America/Bogota')::date as d
  ),
  open_spans as (
    select s.starts_at, s.ends_at
    from day, private.barber_open_spans(p_barbershop_id, p_barber_id, day.d) s
    where p_barber_id is not null
    union all
    -- date + time is a Bogotá wall clock; 24:00 is the next midnight.
    select (day.d + h.start_time) at time zone 'America/Bogota',
           (day.d + h.end_time) at time zone 'America/Bogota'
    from day
    join public.barbershop_hours h
      on h.barbershop_id = p_barbershop_id
     and h.weekday = extract(dow from day.d)
    where p_barber_id is null
  ),
  open_time as (
    select coalesce(range_agg(tstzrange(o.starts_at, o.ends_at, '[)')), '{}'::tstzmultirange) as r
    from open_spans o
    where o.starts_at < o.ends_at
  ),
  closures as (
    select coalesce(range_agg(tstzrange(t.starts_at, t.ends_at, '[)')), '{}'::tstzmultirange) as r
    from public.time_blocks t
    where t.barbershop_id = p_barbershop_id
      and t.barber_id is null
      and t.starts_at < p_ends_at
      and t.ends_at > p_starts_at
  )
  select not (
      private.is_colombian_holiday(day.d)
      and not exists (
        select 1
        from public.holiday_openings o
        where o.barbershop_id = p_barbershop_id
          and o.holiday_date = day.d
      )
    )
    and not isempty(
      (open_time.r * tstzmultirange(tstzrange(p_starts_at, p_ends_at, '[)'))) - closures.r
    )
  from day, open_time, closures
$$;

revoke all on function private.block_has_open_time(uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated;

-- 2. The professional's block, on the shared rule -----------------------------------------------------
-- The body of add_professional_accounts, with private.block_has_open_time in
-- place of the quarter hours it walked.

create or replace function private.create_time_block_of(
  p_barber private.barber_access,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  block_day date;
  new_id uuid;
begin
  if not p_barber.writable then
    raise exception 'the barbershop is read only'
      using errcode = 'P0001', hint = 'read_only';
  end if;
  if not p_barber.barber_active then
    raise exception 'barber is inactive'
      using errcode = 'P0001', hint = 'barber_inactive';
  end if;

  -- The reasons of B-04, as the owner's agenda shows them; "Otro" is none.
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at
    or (p_reason is not null and p_reason not in ('Almuerzo', 'Permiso', 'Diligencia')) then
    raise exception 'invalid block'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;
  -- From the current quarter hour: the barber can block the rest of it.
  if p_starts_at < date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00+00') then
    raise exception 'the block starts in the past'
      using errcode = 'P0001', hint = 'too_early';
  end if;
  block_day := (p_starts_at at time zone 'America/Bogota')::date;
  if p_starts_at <> date_bin('15 minutes', p_starts_at, timestamptz '2000-01-01 00:00+00')
    or p_ends_at <> date_bin('15 minutes', p_ends_at, timestamptz '2000-01-01 00:00+00')
    or p_ends_at > (block_day + 1)::timestamp at time zone 'America/Bogota'
    or block_day > private.today_bogota() + 30 then
    raise exception 'one day, in steps of 15 minutes, up to 30 days ahead'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;

  perform private.lock_booking_day(p_barber.barbershop_id, block_day);

  -- Task 7.4: only time that is open can be blocked.
  if not private.block_has_open_time(p_barber.barbershop_id, p_barber.barber_id, p_starts_at, p_ends_at) then
    raise exception 'nothing open to block'
      using errcode = 'P0001', hint = 'already_closed';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barber.barbershop_id
      and a.barber_id = p_barber.barber_id
      and a.status in ('confirmed', 'attended', 'no_show')
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'there is an appointment in between'
      using errcode = 'P0001', hint = 'overlaps_appointment';
  end if;
  if exists (
    select 1
    from public.time_blocks t
    where t.barbershop_id = p_barber.barbershop_id
      and t.barber_id = p_barber.barber_id
      and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'there is a block in between'
      using errcode = 'P0001', hint = 'overlaps_block';
  end if;

  insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
  values (p_barber.barbershop_id, p_barber.barber_id, p_starts_at, p_ends_at, nullif(btrim(p_reason), ''))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function private.create_time_block_of(private.barber_access, timestamptz, timestamptz, text)
  from public, anon, authenticated;

-- 3. The owner's block (D-39), on the shared rule ------------------------------------------------------

create or replace function public.create_time_block(
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
  -- Paused first, as the professional's block does (review of 8.14, B1): a
  -- paused establishment hears it is paused, not that the day is closed.
  -- The criterion of private.require_writable_block (read_only_when_suspended)
  -- for the owner's writes: active, or awaiting its first payment (decision
  -- S5). The trigger stays, for every other path.
  if coalesce(private.phase_of(p_barbershop_id), '') not in ('active', 'awaiting_first_payment') then
    raise exception 'barbershop is read only'
      using errcode = 'insufficient_privilege', hint = 'barbershop_read_only';
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
    -- A deleted professional is inactive too (barbers_deleted_has_no_data).
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

  -- The lock of a booking of that day, before reading what is open: a
  -- closure, a block and a booking of the same day run one after the other.
  perform private.lock_booking_day(p_barbershop_id, block_day);

  -- Task 8.14: only time that is open can be blocked, for that professional
  -- or for the whole establishment.
  if not private.block_has_open_time(p_barbershop_id, p_barber_id, p_starts_at, p_ends_at) then
    raise exception 'nothing open to block'
      using errcode = 'P0001', hint = 'already_closed';
  end if;

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
  -- A professional's block clashes with their own blocks; a closure, with
  -- another closure.
  if exists (
    select 1
    from public.time_blocks t
    where t.barbershop_id = p_barbershop_id
      and t.barber_id is not distinct from p_barber_id
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

-- Create or replace keeps the privileges; said again so the file stands on
-- its own: the owner's session only, never anon.
revoke all on function public.create_time_block(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.create_time_block(uuid, uuid, timestamptz, timestamptz, text) to authenticated;
