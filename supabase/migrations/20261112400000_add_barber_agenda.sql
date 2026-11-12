-- Task 4.4 (docs/tareas/4.4-mi-agenda-barbero.md): "Mi agenda" of a barber.
--
-- The barber reaches their agenda through their private link, /b/<token>,
-- without an account. Only the SHA-256 of the token is stored
-- (barbers.link_token_hash, task 2.3). These functions are the only way in:
-- all security definer for anon and authenticated, and they receive the
-- hash, never the token (decision 0006, "Mi agenda del barbero (4.4)").
--
-- - A link works while link_active and the barbershop is not deleted, even
--   if the barber is inactive (spec: they still handle the appointments they
--   had). Any other hash gives nothing, the same for a made-up one (B-05).
-- - What the barber sees: their own appointments that take time and their
--   own blocks, plus the closures of the whole barbershop; the customer's
--   short name ("Camila R."), the names of the services and the times. Never
--   a price, a total, an email, a phone, notes or another barber (spec,
--   "Link privado del barbero"; design note of B-03).
-- - barber_agenda: the days [p_from, p_to] (at most 7), with the shifts and
--   the hours of the barbershop to draw the week (B-02).
-- - barber_appointment: one appointment of their own (B-03), with the visits
--   and no-shows of the customer in that barbershop.
-- - mark_appointment_by_barber: attended or no_show, only for a confirmed
--   appointment of their own that already started (provisional decisions
--   B2 and B3). Also with the barbershop suspended (spec, Suscripciones,
--   point 6). The barber does not cancel (decision B1, as the design says).
-- - create_time_block_by_barber: an active barber and an active barbershop;
--   one Bogotá day, in steps of 15 minutes, from the current quarter hour to
--   30 days ahead (decision B5), and no appointment of theirs in between
--   (B-04). It takes the lock of a public booking of that barbershop and
--   day, so a block and a booking see each other.
-- - delete_time_block_by_barber: a block of their own that has not ended,
--   with an active barbershop; never a closure of the whole barbershop
--   (decision B4).
--
-- The changes set yapoin.actor to 'barber', so the history
-- (log_appointment_event) records who made them.
--
-- Errors carry a hint the app maps (src/modulos/agenda/datos/barber-errors.ts):
-- link_invalid, read_only, not_yours, not_confirmed, too_early,
-- status_invalid, barber_inactive, range_invalid, overlaps_appointment,
-- overlaps_block.

-- 1. The barber behind a link -------------------------------------------------------------------

create function private.barber_by_link(p_token_hash text)
returns table (
  barber_id uuid,
  barbershop_id uuid,
  display_name text,
  barber_active boolean,
  uses_barbershop_hours boolean,
  barbershop_name text,
  writable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    br.id,
    br.barbershop_id,
    br.display_name,
    br.active,
    br.uses_barbershop_hours,
    b.name,
    private.barbershop_phase(
      b.subscription_status, b.plan, b.trial_ends_on, b.expires_on,
      (b.created_at at time zone 'America/Bogota')::date
    ) = 'active'
  from public.barbers br
  join public.barbershops b on b.id = br.barbershop_id
  where p_token_hash is not null
    and private.is_token_hash(p_token_hash)
    and br.link_token_hash = p_token_hash
    and br.link_active
    and b.deleted_at is null
$$;

revoke all on function private.barber_by_link(text) from public;

-- "Camila Rojas Pérez" -> "Camila R.", as shortCustomerName in
-- src/modulos/agenda/dominio/owner-agenda.ts.
create function private.short_customer_name(full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(btrim(regexp_replace(full_name, '\s+', ' ', 'g')), ' ', 2) = ''
      then btrim(full_name)
    else split_part(btrim(regexp_replace(full_name, '\s+', ' ', 'g')), ' ', 1) || ' '
      || upper(left(split_part(btrim(regexp_replace(full_name, '\s+', ' ', 'g')), ' ', 2), 1)) || '.'
  end
$$;

revoke all on function private.short_customer_name(text) from public;

-- 2. barber_agenda ------------------------------------------------------------------------------

create function public.barber_agenda(p_token_hash text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  barber record;
  range_start timestamptz;
  range_end timestamptz;
begin
  select * into barber from private.barber_by_link(p_token_hash);
  if not found then
    return null;
  end if;

  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 6 then
    raise exception 'at most 7 days'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;
  range_start := p_from::timestamp at time zone 'America/Bogota';
  range_end := (p_to + 1)::timestamp at time zone 'America/Bogota';

  return jsonb_build_object(
    'barber', jsonb_build_object(
      'id', barber.barber_id,
      'name', barber.display_name,
      'active', barber.barber_active
    ),
    'barbershop', jsonb_build_object(
      'name', barber.barbershop_name,
      'writable', barber.writable
    ),
    'schedule', jsonb_build_object(
      'usesBarbershopHours', barber.uses_barbershop_hours,
      'shifts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'weekday', s.weekday,
          'start', to_char(s.start_time, 'HH24:MI'),
          'end', to_char(s.end_time, 'HH24:MI')
        ) order by s.weekday, s.start_time)
        from public.barber_schedules s
        where s.barbershop_id = barber.barbershop_id
          and s.barber_id = barber.barber_id
      ), '[]'::jsonb)
    ),
    'shopHours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', h.weekday,
        'start', to_char(h.start_time, 'HH24:MI'),
        'end', to_char(h.end_time, 'HH24:MI')
      ) order by h.weekday, h.start_time)
      from public.barbershop_hours h
      where h.barbershop_id = barber.barbershop_id
    ), '[]'::jsonb),
    'holidayOpenings', coalesce((
      select jsonb_agg(to_char(o.holiday_date, 'YYYY-MM-DD') order by o.holiday_date)
      from public.holiday_openings o
      where o.barbershop_id = barber.barbershop_id
        and o.holiday_date between p_from and p_to
    ), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'startsAt', a.starts_at,
        'endsAt', a.ends_at,
        'status', a.status,
        'source', a.source,
        'createdAt', a.created_at,
        'customerName', private.short_customer_name(c.full_name),
        'services', coalesce((
          select jsonb_agg(sv.name order by l.position)
          from public.appointment_services l
          join public.services sv
            on sv.barbershop_id = l.barbershop_id and sv.id = l.service_id
          where l.barbershop_id = a.barbershop_id
            and l.appointment_id = a.id
        ), '[]'::jsonb)
      ) order by a.starts_at)
      from public.appointments a
      join public.customers c
        on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
      where a.barbershop_id = barber.barbershop_id
        and a.barber_id = barber.barber_id
        and a.status in ('confirmed', 'attended', 'no_show')
        and a.starts_at < range_end
        and a.ends_at > range_start
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'own', t.barber_id is not null,
        'startsAt', t.starts_at,
        'endsAt', t.ends_at,
        'reason', t.reason
      ) order by t.starts_at)
      from public.time_blocks t
      where t.barbershop_id = barber.barbershop_id
        and (t.barber_id = barber.barber_id or t.barber_id is null)
        and t.starts_at < range_end
        and t.ends_at > range_start
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.barber_agenda(text, date, date) from public;
grant execute on function public.barber_agenda(text, date, date) to anon, authenticated;

-- 3. barber_appointment (B-03) ------------------------------------------------------------------

create function public.barber_appointment(p_token_hash text, p_appointment_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  source public.appointment_source,
  created_at timestamptz,
  customer_name text,
  service_names text[],
  service_minutes integer[],
  visits integer,
  no_shows integer,
  writable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.starts_at,
    a.ends_at,
    a.status,
    a.source,
    a.created_at,
    private.short_customer_name(c.full_name),
    array(
      select sv.name
      from public.appointment_services l
      join public.services sv on sv.barbershop_id = l.barbershop_id and sv.id = l.service_id
      where l.barbershop_id = a.barbershop_id and l.appointment_id = a.id
      order by l.position
    ),
    array(
      select l.duration_minutes
      from public.appointment_services l
      where l.barbershop_id = a.barbershop_id and l.appointment_id = a.id
      order by l.position
    ),
    (select count(*)::integer from public.appointments v
     where v.barbershop_id = a.barbershop_id and v.customer_id = a.customer_id and v.status = 'attended'),
    (select count(*)::integer from public.appointments v
     where v.barbershop_id = a.barbershop_id and v.customer_id = a.customer_id and v.status = 'no_show'),
    barber.writable
  from private.barber_by_link(p_token_hash) barber
  join public.appointments a
    on a.barbershop_id = barber.barbershop_id and a.barber_id = barber.barber_id
  join public.customers c
    on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
  where a.id = p_appointment_id
$$;

revoke all on function public.barber_appointment(text, uuid) from public;
grant execute on function public.barber_appointment(text, uuid) to anon, authenticated;

-- 4. mark_appointment_by_barber ---------------------------------------------------------------------

create function public.mark_appointment_by_barber(
  p_token_hash text,
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
  barber record;
  found_appointment public.appointments;
begin
  perform set_config('yapoin.actor', 'barber', true);

  select * into barber from private.barber_by_link(p_token_hash);
  if not found then
    raise exception 'unknown link'
      using errcode = 'P0001', hint = 'link_invalid';
  end if;

  if p_status is null or p_status not in ('attended', 'no_show') then
    raise exception 'the link marks attended or no_show only'
      using errcode = 'invalid_parameter_value', hint = 'status_invalid';
  end if;

  select a.* into found_appointment
  from public.appointments a
  where a.id = p_appointment_id
    and a.barbershop_id = barber.barbershop_id
    and a.barber_id = barber.barber_id
  for update;
  if not found then
    raise exception 'not an appointment of this barber'
      using errcode = 'P0001', hint = 'not_yours';
  end if;

  if found_appointment.status <> 'confirmed' then
    raise exception 'only a confirmed appointment is marked'
      using errcode = 'P0001', hint = 'not_confirmed';
  end if;

  if found_appointment.starts_at > now() then
    raise exception 'the appointment has not started'
      using errcode = 'P0001', hint = 'too_early';
  end if;

  update public.appointments
  set status = p_status
  where id = found_appointment.id;
end;
$$;

revoke all on function public.mark_appointment_by_barber(text, uuid, public.appointment_status) from public;
grant execute on function public.mark_appointment_by_barber(text, uuid, public.appointment_status)
  to anon, authenticated;

-- 5. create_time_block_by_barber --------------------------------------------------------------------

create function public.create_time_block_by_barber(
  p_token_hash text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
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

  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at
    or (p_reason is not null and char_length(p_reason) > 40) then
    raise exception 'invalid block'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;
  -- From the current quarter hour: the barber can block the rest of it.
  if p_starts_at < date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00+00') then
    raise exception 'the block starts in the past'
      using errcode = 'P0001', hint = 'too_early';
  end if;
  block_day := (p_starts_at at time zone 'America/Bogota')::date;
  if extract(epoch from p_starts_at)::bigint % 900 <> 0
    or extract(epoch from p_ends_at)::bigint % 900 <> 0
    or p_ends_at > (block_day + 1)::timestamp at time zone 'America/Bogota'
    or block_day > private.today_bogota() + 30 then
    raise exception 'one day, in steps of 15 minutes, up to 30 days ahead'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;

  -- The same lock as a public booking of that barbershop and Bogotá day, so
  -- the two see each other.
  perform pg_advisory_xact_lock(
    hashtextextended('book_appointment:' || barber.barbershop_id::text || ':' || block_day::text, 0)
  );

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

revoke all on function public.create_time_block_by_barber(text, timestamptz, timestamptz, text) from public;
grant execute on function public.create_time_block_by_barber(text, timestamptz, timestamptz, text)
  to anon, authenticated;

-- 6. delete_time_block_by_barber --------------------------------------------------------------------

create function public.delete_time_block_by_barber(p_token_hash text, p_block_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barber record;
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

  delete from public.time_blocks t
  where t.id = p_block_id
    and t.barbershop_id = barber.barbershop_id
    and t.barber_id = barber.barber_id
    and t.ends_at > now();
  if not found then
    raise exception 'not a block of this barber'
      using errcode = 'P0001', hint = 'not_yours';
  end if;
end;
$$;

revoke all on function public.delete_time_block_by_barber(text, uuid) from public;
grant execute on function public.delete_time_block_by_barber(text, uuid) to anon, authenticated;
