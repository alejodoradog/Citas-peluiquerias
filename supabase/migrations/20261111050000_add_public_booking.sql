-- Tasks 3.2 and 3.3 (docs/tareas/3.2-3.3-reservas.md): the public booking.
--
-- anon reads the public profile (barbershops, services, barbers, hours,
-- holidays, blocks) through its column grants, but never appointments or
-- customers. This migration gives it exactly three functions:
--
-- 1. barbershop_accepts_bookings(id): whether the public page takes bookings
--    (decision 0006: phase 'active'; a deleted barbershop never does).
-- 2. booking_busy_ranges(id, from, until): the ranges that appointments take,
--    and nothing else (no id, customer, price or status), for the
--    availability engine of task 3.1.
-- 3. book_appointment(...): the booking itself, security definer.
--
-- The engine (src/modulos/agenda/dominio/availability.ts) only offers; it is
-- not the authority. Anyone with the publishable key can call
-- book_appointment directly, so the function enforces in SQL, inside its
-- transaction, the same rules 1 to 8 of the engine (docs/tareas/3.1,
-- provisional decisions 1 to 6): the booking window (today to today + 30 in
-- Bogotá), the minimum notice, quarter hours of the Bogotá clock, the whole
-- appointment inside one shift of the barbershop and of the barber (the
-- barber's own hours cut to the barbershop's; shifts that touch are joined),
-- Colombian holidays closed unless holiday_openings opens them, and blocks of
-- the barbershop or of the barber. supabase/tests/database/28_public_booking
-- runs the cases of availability.test.ts against these functions, and
-- src/modulos/agenda/dominio/booking-rules.sql.test.ts runs the same cases
-- through the engine (decision 0005, point 16).
--
-- These rules live in the booking function only, not in the appointment
-- triggers: the owner may still book by hand over a block or outside hours
-- (decision 0003).
--
-- Concurrency:
-- - Every public booking of a barbershop and Bogotá day takes the same
--   transaction advisory lock, so two of them run one after the other and the
--   second one sees the first (each statement of a read committed function
--   takes a new snapshot). "El primero disponible" counts and chooses with
--   consistent data.
-- - A manual appointment of the panel does not take that lock: the exclusion
--   constraint still refuses the overlap (23P01), and the booking tries the
--   next free barber or answers slot_taken.
-- - The barbershop row is locked for key share first: a deletion (which locks
--   it for update) and a booking run one after the other.
--
-- Errors carry a hint the app maps (src/modulos/agenda/datos/booking-errors.ts):
-- not_accepting, slot_taken, booking_notice, outside_booking_window,
-- outside_hours, closed, blocked, slot_invalid, barber_unavailable,
-- service_inactive, services_required, services_repeated, booking_too_long,
-- customer_name_invalid, customer_email_invalid, customer_phone_invalid,
-- token_invalid, range_invalid.

-- 1. Phase and barbershop_accepts_bookings -----------------------------------------
-- barbershop_phase is the function of decision 0006, section 4, word for
-- word. Task 5.4 adds its copy in TypeScript, with the test that compares
-- both (the app does not need it before: the page asks the database).

create function private.barbershop_phase(
  status public.subscription_status,
  plan text,
  trial_ends_on date,
  expires_on date,
  created_on date
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when status = 'suspended' then 'suspended'
    when plan is null and trial_ends_on < created_on then 'awaiting_first_payment'
    when private.today_bogota() <= expires_on + 5 then 'active'
    else 'expired'
  end
$$;

revoke all on function private.barbershop_phase(public.subscription_status, text, date, date, date) from public;

-- For the public page (anon cannot read the subscription columns) and for
-- book_appointment. Unknown and deleted barbershops never accept.
create function public.barbershop_accepts_bookings(p_barbershop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select b.deleted_at is null
      and private.barbershop_phase(
        b.subscription_status, b.plan, b.trial_ends_on, b.expires_on,
        (b.created_at at time zone 'America/Bogota')::date
      ) = 'active'
    from public.barbershops b
    where b.id = p_barbershop_id
  ), false)
$$;

revoke all on function public.barbershop_accepts_bookings(uuid) from public;
grant execute on function public.barbershop_accepts_bookings(uuid) to anon, authenticated;

-- 2. Colombian holidays ---------------------------------------------------------------
-- The same rule as src/lib/fechas/festivos.ts (Ley 51 de 1983 and Ley 2578
-- de 2026). 28_public_booking compares both copies for 2024-2032.

-- Anonymous Gregorian algorithm. Every operand is positive, so integer
-- division is the floor of festivos.ts.
create function private.easter_sunday(p_year integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  a integer := p_year % 19;
  b integer := p_year / 100;
  c integer := p_year % 100;
  d integer := b / 4;
  e integer := b % 4;
  f integer := (b + 8) / 25;
  g integer := (b - f + 1) / 3;
  h integer := (19 * a + b - d - g + 15) % 30;
  i integer := c / 4;
  k integer := c % 4;
  l integer := (32 + 2 * e + 2 * i - h - k) % 7;
  m integer := (a + 11 * h + 22 * l) / 451;
begin
  return make_date(p_year, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

-- The days off of a year, in order, once each.
create function private.colombian_holidays(p_year integer)
returns setof date
language sql
immutable
set search_path = ''
as $$
  select distinct day
  from (
    -- Fixed: they stay on their date even on a weekend.
    select make_date(p_year, f.month, f.day) as day
    from (values (1, 1), (5, 1), (7, 20), (8, 7), (12, 8), (12, 25)) as f (month, day)
    union all
    -- Moved to the next Monday unless the date is a Monday. The Virgin of
    -- Chiquinquirá (July 9) from 2026 on.
    select x.day + ((8 - extract(dow from x.day)::integer) % 7)
    from (
      select make_date(p_year, m.month, m.day) as day
      from (values (1, 6), (3, 19), (6, 29), (8, 15), (10, 12), (11, 1), (11, 11), (7, 9)) as m (month, day)
      where (m.month, m.day) <> (7, 9) or p_year >= 2026
    ) as x
    union all
    -- Holy Thursday, Good Friday, Ascension, Corpus Christi and Sacred Heart.
    select private.easter_sunday(p_year) + o.offset_days
    from (values (-3), (-2), (43), (64), (71)) as o (offset_days)
  ) as holidays
  order by day
$$;

create function private.is_colombian_holiday(p_date date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
    from private.colombian_holidays(extract(year from p_date)::integer) as h (day)
    where h.day = p_date
  )
$$;

revoke all on function private.easter_sunday(integer) from public;
revoke all on function private.colombian_holidays(integer) from public;
revoke all on function private.is_colombian_holiday(date) from public;

-- 3. The rules of the engine in SQL ------------------------------------------------------

-- BOOKING_WINDOW_DAYS of src/modulos/barberias/dominio/policies.ts; a test
-- compares both.
create function private.booking_window_days()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 30
$$;

-- Rules of the day and the barbershop (engine rules 1 holiday, 6, 7 and 8):
-- null when the start may be booked with that notice at p_now, otherwise the
-- hint. p_now is a parameter so the tests can fix the clock.
create function private.booking_time_problem(
  p_barbershop_id uuid,
  p_starts_at timestamptz,
  p_minutes integer,
  p_now timestamptz
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when b.id is null then 'not_accepting'
    when p_starts_at is null or p_now is null or p_minutes is null
      or p_minutes not between 5 and 480 then 'slot_invalid'
    -- Quarter hours of the Bogotá clock, no seconds (fractions included).
    when extract(second from clock.start_local) <> 0
      or extract(minute from clock.start_local)::integer % 15 <> 0 then 'slot_invalid'
    -- Today to today + 30 in Bogotá, both included (3.1, P1).
    when clock.start_local::date < clock.today
      or clock.start_local::date > clock.today + private.booking_window_days() then 'outside_booking_window'
    -- The notice counts up to the start, the edge included (3.1, P6).
    when p_starts_at < p_now + make_interval(mins => b.min_booking_notice_minutes) then 'booking_notice'
    -- A holiday is closed unless the barbershop opens it.
    when private.is_colombian_holiday(clock.start_local::date)
      and not exists (
        select 1 from public.holiday_openings h
        where h.barbershop_id = b.id and h.holiday_date = clock.start_local::date
      ) then 'closed'
    else null
  end
  from (
    select p_starts_at at time zone 'America/Bogota' as start_local,
           (p_now at time zone 'America/Bogota')::date as today
  ) as clock
  left join public.barbershops b on b.id = p_barbershop_id
$$;

-- The hours a barber takes appointments on a Bogotá day, as instants (engine
-- rules 1 to 3): the barbershop's shifts of that weekday, or the barber's own
-- shifts cut to them; shifts that touch are joined (3.1, P4). Nothing for an
-- inactive barber or one of another barbershop. Holidays are checked by
-- booking_time_problem; an open holiday uses its weekday's hours (3.1, P5).
create function private.barber_open_spans(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with barber as (
    select br.uses_barbershop_hours
    from public.barbers br
    where br.barbershop_id = p_barbershop_id
      and br.id = p_barber_id
      and br.active
  ),
  shop_raw as (
    select h.start_time as s, h.end_time as e
    from public.barbershop_hours h
    where h.barbershop_id = p_barbershop_id
      and h.weekday = extract(dow from p_date)
  ),
  own_raw as (
    select bs.start_time as s, bs.end_time as e
    from public.barber_schedules bs
    where bs.barbershop_id = p_barbershop_id
      and bs.barber_id = p_barber_id
      and bs.weekday = extract(dow from p_date)
  ),
  -- Gaps and islands: a shift starts a new island unless it starts at or
  -- before the end of an earlier one.
  shop_marked as (
    select s, e,
      case when s <= max(e) over (order by s, e rows between unbounded preceding and 1 preceding)
        then 0 else 1 end as starts_island
    from shop_raw
  ),
  shop as (
    select min(s) as s, max(e) as e
    from (select s, e, sum(starts_island) over (order by s, e rows unbounded preceding) as island from shop_marked) x
    group by island
  ),
  own_marked as (
    select s, e,
      case when s <= max(e) over (order by s, e rows between unbounded preceding and 1 preceding)
        then 0 else 1 end as starts_island
    from own_raw
  ),
  own as (
    select min(s) as s, max(e) as e
    from (select s, e, sum(starts_island) over (order by s, e rows unbounded preceding) as island from own_marked) x
    group by island
  ),
  spans as (
    select shop.s, shop.e
    from shop, barber
    where barber.uses_barbershop_hours
    union all
    select greatest(own.s, shop.s), least(own.e, shop.e)
    from own
    join shop on own.s < shop.e and shop.s < own.e
    cross join barber
    where not barber.uses_barbershop_hours
  )
  -- date + time is a Bogotá wall clock; 24:00 is the next midnight.
  select (p_date + spans.s) at time zone 'America/Bogota',
         (p_date + spans.e) at time zone 'America/Bogota'
  from spans
  order by 1
$$;

-- Rules of one barber (engine rules 2 to 5): null when the barber may take
-- [p_starts_at, p_ends_at), otherwise the hint. Half-open ranges, as the
-- exclusion constraint.
create function private.barber_slot_problem(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
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
    -- The same predicate as appointments_no_overlap, so it uses its index.
    when exists (
      select 1
      from public.appointments a
      where a.barber_id = p_barber_id
        and a.status in ('confirmed', 'attended', 'no_show')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ) then 'slot_taken'
    else null
  end
$$;

revoke all on function private.booking_window_days() from public;
revoke all on function private.booking_time_problem(uuid, timestamptz, integer, timestamptz) from public;
revoke all on function private.barber_open_spans(uuid, uuid, date) from public;
revoke all on function private.barber_slot_problem(uuid, uuid, timestamptz, timestamptz) from public;

-- 4. booking_busy_ranges ------------------------------------------------------------------
-- What the availability engine needs and nothing more: barber and range of
-- each appointment that takes the time (confirmed, attended, no_show) of the
-- active barbers. At most 32 days per call, between yesterday and the end of
-- the booking window (+ 1 day). Empty when the barbershop takes
-- no bookings, so a suspended or deleted barbershop shows nothing.

create function public.booking_busy_ranges(
  p_barbershop_id uuid,
  p_from timestamptz,
  p_until timestamptz
)
returns table (barber_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Only around the booking window: from yesterday (the appointments of
  -- today that started before midnight count for "el primero disponible")
  -- to the end of today + 30 in Bogotá, with a day of margin. The past and
  -- the far future of a barbershop are nobody's business (security review
  -- of 3.2: anyone could walk the whole history 32 days at a time).
  if p_from is null or p_until is null or p_until <= p_from
    or p_until - p_from > interval '32 days'
    or p_from < now() - interval '1 day'
    or p_until > (private.today_bogota() + private.booking_window_days() + 2)::timestamp
                 at time zone 'America/Bogota' then
    raise exception 'between 1 second and 32 days, around the booking window'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;
  if not public.barbershop_accepts_bookings(p_barbershop_id) then
    return;
  end if;

  return query
  select a.barber_id, a.starts_at, a.ends_at
  from public.appointments a
  join public.barbers br
    on br.barbershop_id = a.barbershop_id and br.id = a.barber_id and br.active
  where a.barbershop_id = p_barbershop_id
    and a.status in ('confirmed', 'attended', 'no_show')
    -- Appointments last at most 480 minutes (check_appointment_lines); the
    -- day of margin keeps the index range bounded.
    and a.starts_at > p_from - interval '1 day'
    and a.starts_at < p_until
    and a.ends_at > p_from
  order by a.starts_at, a.barber_id;
end;
$$;

revoke all on function public.booking_busy_ranges(uuid, timestamptz, timestamptz) from public;
grant execute on function public.booking_busy_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;

-- 5. book_appointment ---------------------------------------------------------------------
-- Decision 0006, "Contrato de las funciones de reserva". Every input is
-- untrusted. p_barber_id null is "el primero disponible": among the active
-- barbers who offer every service and are free for the whole appointment,
-- the one with the fewest appointments that take the time that Bogotá day
-- (counted on the day they start, past ones included), then sort_order, then
-- id (3.1, P2). If the chosen barber is taken in the meantime (23P01, a
-- manual appointment), it tries the next one.
--
-- The customer is found by email (trimmed, lowercase) in that barbershop and
-- never changed (3.3: a public booking does not overwrite an existing
-- customer); a new email creates one. Only the hash of the manage token is
-- received and stored (task 3.4 delivers the link).
--
-- The two optional inputs go last with a default, so the generated types
-- let the app leave them out ("el primero disponible", no phone).

create function public.book_appointment(
  p_barbershop_id uuid,
  p_starts_at timestamptz,
  p_service_ids uuid[],
  p_customer_name text,
  p_customer_email text,
  p_manage_token_hash text,
  p_barber_id uuid default null,
  p_customer_phone text default null
)
returns table (appointment_id uuid, barber_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  customer_name text := btrim(p_customer_name);
  customer_email text := lower(btrim(p_customer_email));
  customer_phone text := nullif(btrim(p_customer_phone), '');
  total_minutes integer;
  found_services integer;
  booking_end timestamptz;
  booking_day date;
  problem text;
  candidates uuid[];
  candidate uuid;
  found_customer uuid;
  new_appointment uuid;
begin
  -- Shape of the input, before touching anything.
  if p_barbershop_id is null or p_starts_at is null then
    raise exception 'barbershop and start required'
      using errcode = 'invalid_parameter_value', hint = 'slot_invalid';
  end if;
  -- No control characters: the name goes to the panel and, from phase 5, to
  -- emails.
  if customer_name is null or char_length(customer_name) not between 1 and 100
    or customer_name ~ '[[:cntrl:]]' then
    raise exception 'name of 1 to 100 characters'
      using errcode = 'invalid_parameter_value', hint = 'customer_name_invalid';
  end if;
  if customer_email is null or not private.is_email(customer_email) then
    raise exception 'valid email required'
      using errcode = 'invalid_parameter_value', hint = 'customer_email_invalid';
  end if;
  -- A Colombian mobile in E.164 (normalizeColombianMobile), or nothing.
  if customer_phone is not null and not (
    private.is_e164_phone(customer_phone) and customer_phone ~ '^\+573[0-9]{9}$'
  ) then
    raise exception 'Colombian mobile in E.164'
      using errcode = 'invalid_parameter_value', hint = 'customer_phone_invalid';
  end if;
  if p_manage_token_hash is null or not private.is_token_hash(p_manage_token_hash) then
    raise exception 'SHA-256 hex digest required'
      using errcode = 'invalid_parameter_value', hint = 'token_invalid';
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

  -- The barbershop row first: a deletion locks it for update, so the two
  -- run one after the other, and this one sees the mark.
  perform 1
  from public.barbershops b
  where b.id = p_barbershop_id
    and b.deleted_at is null
  for key share;
  if not found or not public.barbershop_accepts_bookings(p_barbershop_id) then
    raise exception 'the barbershop takes no bookings'
      using errcode = 'P0001', hint = 'not_accepting';
  end if;

  -- Active services of this barbershop; create_appointment locks them again.
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
      using errcode = 'invalid_parameter_value', hint = 'booking_too_long';
  end if;
  booking_end := p_starts_at + make_interval(mins => total_minutes);
  booking_day := (p_starts_at at time zone 'America/Bogota')::date;

  -- One public booking at a time per barbershop and Bogotá day (see the
  -- header). Taken before any availability check, so the checks below see
  -- every booking that committed before.
  perform pg_advisory_xact_lock(
    hashtextextended('book_appointment:' || p_barbershop_id::text || ':' || booking_day::text, 0)
  );

  problem := private.booking_time_problem(p_barbershop_id, p_starts_at, total_minutes, now());
  if problem is not null then
    raise exception 'the time cannot be booked'
      using errcode = 'P0001', hint = problem;
  end if;

  -- The barbers who may take it: active, offering every service, ordered for
  -- "el primero disponible". A chosen barber is the only candidate.
  select coalesce(array_agg(br.id order by
    (select count(*)
     from public.appointments a
     where a.barbershop_id = p_barbershop_id
       and a.barber_id = br.id
       and a.status in ('confirmed', 'attended', 'no_show')
       and a.starts_at >= booking_day::timestamp at time zone 'America/Bogota'
       and a.starts_at < (booking_day + 1)::timestamp at time zone 'America/Bogota'),
    br.sort_order, br.id), '{}')
  into candidates
  from public.barbers br
  where br.barbershop_id = p_barbershop_id
    and br.active
    and (p_barber_id is null or br.id = p_barber_id)
    and not exists (
      select 1
      from unnest(p_service_ids) as t (sid)
      where not exists (
        select 1 from public.barber_services bs
        where bs.barbershop_id = p_barbershop_id
          and bs.barber_id = br.id
          and bs.service_id = t.sid
      )
    );
  if cardinality(candidates) = 0 then
    raise exception 'no barber offers these services'
      using errcode = 'P0001', hint = 'barber_unavailable';
  end if;

  -- A chosen barber reports why the time does not work for them; "el
  -- primero disponible" skips the barbers who are not free.
  if p_barber_id is not null then
    problem := private.barber_slot_problem(p_barbershop_id, p_barber_id, p_starts_at, booking_end);
    if problem is not null then
      raise exception 'the time cannot be booked'
        using errcode = 'P0001', hint = problem;
    end if;
  else
    select coalesce(array_agg(c.id order by c.ord), '{}')
    into candidates
    from unnest(candidates) with ordinality as c (id, ord)
    where private.barber_slot_problem(p_barbershop_id, c.id, p_starts_at, booking_end) is null;
  end if;

  -- The customer, by email, never changed.
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

  -- The customer's own action (decision 0006, actor of the history).
  perform set_config('yapoin.actor', 'customer', true);

  foreach candidate in array candidates loop
    begin
      new_appointment := public.create_appointment(
        p_barbershop_id, found_customer, candidate, p_starts_at, p_service_ids,
        'web', p_manage_token_hash
      );
      appointment_id := new_appointment;
      barber_id := candidate;
      return next;
      return;
    exception
      when exclusion_violation then
        -- Taken in the meantime by a manual appointment: the next barber.
        null;
      when unique_violation then
        raise exception 'manage token already used'
          using errcode = 'invalid_parameter_value', hint = 'token_invalid';
    end;
  end loop;

  raise exception 'the time was taken'
    using errcode = 'P0001', hint = 'slot_taken';
end;
$$;

revoke all on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text) from public;
grant execute on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text) to anon, authenticated;
