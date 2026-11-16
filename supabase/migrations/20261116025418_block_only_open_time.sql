-- Task 7.4 (docs/tareas/7.4-bloqueos.md): a professional could block hours
-- of a holiday the establishment had already closed. create_time_block_by_barber
-- now refuses a block with no open time in it, with the hint already_closed:
-- a holiday that is not opened, a day the professional does not work, hours
-- outside their shifts, or hours the establishment closed for everyone.
--
-- Everything else is the function of add_barber_agenda, unchanged: the same
-- signature, so its grants stay (anon and authenticated, by the link).
-- "Todo el día" (the whole day) is sent by the app as 0:00 to 24:00, or from
-- the current quarter hour today; the function already took that range.

create or replace function public.create_time_block_by_barber(
  p_token_hash text,
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
  barber record;
  block_day date;
  new_id uuid;
begin
  perform set_config('yapoin.actor', 'barber', true);

  select * into barber from private.barber_by_link(p_token_hash);
  if not found then
    raise exception 'unknown link'
      using errcode = 'P0001', hint = 'link_invalid';
  end if;
  if not barber.writable then
    raise exception 'the barbershop is read only'
      using errcode = 'P0001', hint = 'read_only';
  end if;
  if not barber.barber_active then
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

  -- The same lock as a public booking of that barbershop and Bogotá day, so
  -- the two see each other. The day before too, in order, because a
  -- booking takes the lock of the day it starts and may run past midnight.
  perform pg_advisory_xact_lock(
    hashtextextended('book_appointment:' || barber.barbershop_id::text || ':' || (block_day - 1)::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('book_appointment:' || barber.barbershop_id::text || ':' || block_day::text, 0)
  );

  -- Task 7.4: only time that is open can be blocked. A holiday the
  -- barbershop does not open, a day the barber does not work and the hours
  -- the barbershop already closed are closed without a block; one more
  -- would only say it twice. The block may run past the open time (a whole
  -- day, 0:00 to 24:00): it is refused when no quarter hour of it is open.
  if (
    private.is_colombian_holiday(block_day)
    and not exists (
      select 1
      from public.holiday_openings o
      where o.barbershop_id = barber.barbershop_id
        and o.holiday_date = block_day
    )
  ) or not exists (
    with open_spans as materialized (
      select s.starts_at, s.ends_at
      from private.barber_open_spans(barber.barbershop_id, barber.barber_id, block_day) s
    )
    select 1
    from generate_series(p_starts_at, p_ends_at - interval '15 minutes', interval '15 minutes') as quarter(at)
    where exists (
      select 1 from open_spans s
      where quarter.at >= s.starts_at and quarter.at < s.ends_at
    )
    and not exists (
      select 1
      from public.time_blocks t
      where t.barbershop_id = barber.barbershop_id
        and t.barber_id is null
        and quarter.at >= t.starts_at and quarter.at < t.ends_at
    )
  ) then
    raise exception 'nothing open to block'
      using errcode = 'P0001', hint = 'already_closed';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.barbershop_id = barber.barbershop_id
      and a.barber_id = barber.barber_id
      and a.status in ('confirmed', 'attended', 'no_show')
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'there is an appointment in between'
      using errcode = 'P0001', hint = 'overlaps_appointment';
  end if;
  if exists (
    select 1
    from public.time_blocks t
    where t.barbershop_id = barber.barbershop_id
      and t.barber_id = barber.barber_id
      and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'there is a block in between'
      using errcode = 'P0001', hint = 'overlaps_block';
  end if;

  insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
  values (barber.barbershop_id, barber.barber_id, p_starts_at, p_ends_at, nullif(btrim(p_reason), ''))
  returning id into new_id;
  return new_id;
end;
$$;
