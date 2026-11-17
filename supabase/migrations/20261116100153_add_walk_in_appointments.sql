-- Task 7.7 (docs/tareas/7.7-cita-inmediata.md, decision D5 of
-- docs/mejoras-revision-2026-11-15.md): the walk-in appointment ("Cita al
-- momento"), for a customer who arrives without a booking.
--
-- - create_my_walk_in: the professional, with their own session (as the
--   other my_* functions: terms accepted, active, establishment writable).
--   No barber nor establishment travels: the database takes them from
--   auth.uid().
-- - create_walk_in_appointment: the owner, choosing the professional of
--   their establishment (private.owner_reaches, as the manual appointment).
-- - my_services: the active services the professional of the session does,
--   for the form (the professional reads no table).
-- - Both creations share one body, private.create_walk_in_of, built on the
--   helpers of the manual appointment (owner_services_minutes,
--   check_owner_barber, lock_booking_day, barber_open_spans): the same rules
--   for services and professional, written once.
--
-- The time is the database's: now(), rounded down to 5 minutes (the
-- lengths of the services are multiples of 5). The length and the prices
-- come from the services, as in any appointment (create_appointment).
--
-- A clash is refused, never forced (D5): the appointment must fit, from its
-- start, in the open hours of the professional, before their next
-- appointment, their own block or a closure of the establishment. The
-- refusal carries the hint walk_in_clash and, in its detail, a JSON object
-- for the app to explain it:
--   {"kind": "appointment" | "block" | "closure" | "closing" | "closed",
--    "at": what it clashes with starts (or the hours end) at,
--    "until": when that ends (null for closing and closed),
--    "freeMinutes": the free minutes from the start, "neededMinutes": the
--    length of the services, "startsAt": the start it would have had}
-- It takes the lock of the public booking for that day (and the day before),
-- so a booking at the same moment either waits for it or is seen by it.
--
-- The customer is optional. With a name, a new customer with that name only
-- (as the manual appointment does with a new customer). Without one, a row
-- marked walk_in, named "Cliente al momento", that list_customers leaves out:
-- the list does not fill with empty records. Giving it a name, an email, a
-- phone or a note later makes it a customer like any other.
--
-- Who made it stays in the history: a 'created' event in appointment_events
-- with the actor ('barber' with the professional's account, or 'staff').
--
-- No email: a walk-in starts at or before now(), and
-- private.queue_appointment_emails queues the reminder and the
-- professional's notice only for appointments that start later.

-- 1. The customer of a walk-in without a name ------------------------------------------------------

alter table public.customers
  add column walk_in boolean not null default false;

alter table public.customers
  add constraint customers_walk_in_has_no_data
  check (not walk_in or (email is null and phone is null and anonymized_at is null));

comment on column public.customers.walk_in is
  'Task 7.7: the customer of a walk-in appointment created without a name. Left out of list_customers. Only the walk-in functions set it; a name, email, phone or note given later clears it.';

-- Runs with the statement's role and calls no helper, so the app's server
-- (service_role), anon and a session are all fine to fire it (the lesson of
-- refuse_deleted_barber, task 7.6c).
create function private.guard_walk_in_customer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Only the security definer functions of this migration (run as their
    -- owner) create one; a session never marks a customer.
    if new.walk_in and current_user in ('authenticated', 'anon') then
      raise exception 'only a walk-in appointment creates this customer'
        using errcode = 'insufficient_privilege', hint = 'walk_in_reserved';
    end if;
    return new;
  end if;

  if new.walk_in and not old.walk_in then
    raise exception 'a customer does not become a walk-in'
      using errcode = 'insufficient_privilege', hint = 'walk_in_reserved';
  end if;
  -- A name, an email, a phone or a note (or the anonymization, which
  -- renames it): from here it is a customer like any other, back in the list,
  -- so no personal data hides behind the walk-in mark.
  if old.walk_in and (
    new.full_name is distinct from old.full_name
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or coalesce(btrim(new.notes), '') <> coalesce(btrim(old.notes), '')
    or new.anonymized_at is distinct from old.anonymized_at
  ) then
    new.walk_in := false;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_walk_in_customer() from public, anon, authenticated;

create trigger guard_walk_in_customer
  before insert or update on public.customers
  for each row execute function private.guard_walk_in_customer();

-- list_customers (task 4.3) as it was, leaving out the walk-ins without a
-- name.
create or replace function public.list_customers(
  p_barbershop_id uuid,
  p_search text default null,
  p_filter text default 'all',
  p_limit integer default 100
)
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  created_at timestamptz,
  visits integer,
  no_shows integer,
  last_visit_at timestamptz,
  next_appointment_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with params as (
    select
      nullif(
        replace(replace(replace(
          lower(translate(btrim(coalesce(p_search, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'aeiouunaeiouun')),
          '\', '\\'), '%', '\%'), '_', '\_'),
        '') as term,
      regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g') as digits
  )
  select
    c.id,
    c.full_name,
    c.email,
    c.phone,
    c.created_at,
    coalesce(s.visits, 0),
    coalesce(s.no_shows, 0),
    s.last_visit_at,
    s.next_appointment_at
  from public.customers c
  cross join params p
  left join lateral (
    select
      (count(*) filter (where a.status = 'attended'))::integer as visits,
      (count(*) filter (where a.status = 'no_show'))::integer as no_shows,
      max(a.starts_at) filter (where a.status = 'attended') as last_visit_at,
      min(a.starts_at) filter (where a.status = 'confirmed' and a.starts_at > now()) as next_appointment_at
    from public.appointments a
    where a.barbershop_id = c.barbershop_id
      and a.customer_id = c.id
  ) s on true
  where c.barbershop_id = p_barbershop_id
    and c.anonymized_at is null
    and not c.walk_in
    and (
      p.term is null
      or lower(translate(c.full_name, 'ÁÉÍÓÚÜÑáéíóúüñ', 'aeiouunaeiouun')) like '%' || p.term || '%'
      or c.email like '%' || p.term || '%'
      or (length(p.digits) >= 3 and c.phone like '%' || p.digits || '%')
    )
    and case p_filter
      when 'no_shows' then coalesce(s.no_shows, 0) >= 1
      when 'new' then c.created_at >= now() - interval '30 days'
      else true
    end
  order by lower(c.full_name), c.id
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
$$;

-- 2. The body of both creations --------------------------------------------------------------------

-- Whether a Bogotá day can open at all: not a holiday the establishment
-- keeps closed (as private.owner_time_problem says 'closed').
create function private.walk_in_day_open(p_barbershop_id uuid, p_day date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not (
    private.is_colombian_holiday(p_day)
    and not exists (
      select 1 from public.holiday_openings h
      where h.barbershop_id = p_barbershop_id
        and h.holiday_date = p_day
    )
  )
$$;

revoke all on function private.walk_in_day_open(uuid, date) from public, anon, authenticated;

-- Who calls it already resolved the establishment and the professional
-- (the session's, or one the owner reaches). Nobody calls it directly.
create function private.create_walk_in_of(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_service_ids uuid[],
  p_customer_name text
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  customer_name text := nullif(btrim(p_customer_name), '');
  -- The minute of the clock rounded down to 5: never in the future, so the
  -- professional can mark it "Atendida" as soon as it is done, and no email
  -- is queued for it.
  starts timestamptz := date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00+00');
  starts_day date := (date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00+00')
    at time zone 'America/Bogota')::date;
  total_minutes integer;
  ends timestamptz;
  open_until timestamptz;
  obstacle record;
  free_until timestamptz;
  clash jsonb;
  found_customer uuid;
  new_id uuid;
begin
  -- Paused (task 5.5): read only, as the trigger of the insert would say.
  if coalesce(private.phase_of(p_barbershop_id), '') <> 'active' then
    raise exception 'barbershop is read only'
      using errcode = 'insufficient_privilege', hint = 'barbershop_read_only';
  end if;
  -- The name is optional; given, the rules of a new customer's name.
  if customer_name is not null and (
    char_length(customer_name) > 100
    or customer_name ~ '[[:cntrl:]]'
    or private.has_link(customer_name)
  ) then
    raise exception 'name of 1 to 100 characters'
      using errcode = 'invalid_parameter_value', hint = 'customer_name_invalid';
  end if;

  -- 1 to 5 distinct active services, 480 minutes at most, an active
  -- professional of the establishment who does all of them.
  total_minutes := private.owner_services_minutes(p_barbershop_id, p_service_ids);
  perform private.check_owner_barber(p_barbershop_id, p_barber_id, p_service_ids);
  ends := starts + make_interval(mins => total_minutes);

  -- The lock of a public booking of that day (and the day before): from
  -- here, what this function reads stays true until it commits.
  perform private.lock_booking_day(p_barbershop_id, starts_day);

  -- The open stretch of the professional that holds the start. A holiday the
  -- establishment does not open has none. Hours never cross midnight in the
  -- data (a night that runs to 2:00 is 20:00-24:00 plus 0:00-2:00 of the
  -- next day), so a stretch that reaches midnight goes on with the next
  -- day's, if it opens at 0:00.
  if private.walk_in_day_open(p_barbershop_id, starts_day) then
    select sp.ends_at into open_until
    from private.barber_open_spans(p_barbershop_id, p_barber_id, starts_day) sp
    where sp.starts_at <= starts and starts < sp.ends_at;
    if open_until = (starts_day + 1)::timestamp at time zone 'America/Bogota'
      and private.walk_in_day_open(p_barbershop_id, starts_day + 1) then
      select coalesce(max(sp.ends_at), open_until) into open_until
      from private.barber_open_spans(p_barbershop_id, p_barber_id, starts_day + 1) sp
      where sp.starts_at = open_until;
    end if;
  end if;

  if open_until is null then
    clash := jsonb_build_object(
      'kind', 'closed', 'at', null, 'until', null, 'freeMinutes', 0,
      'neededMinutes', total_minutes, 'startsAt', starts);
  else
    -- The first thing that takes the professional's time inside the
    -- appointment: an appointment that occupies (as the exclusion
    -- constraint), their own block or a closure of the establishment.
    select o.kind, o.starts_at, o.ends_at into obstacle
    from (
      select 'appointment' as kind, a.starts_at, a.ends_at
      from public.appointments a
      where a.barbershop_id = p_barbershop_id
        and a.barber_id = p_barber_id
        and a.status in ('confirmed', 'attended', 'no_show')
        and a.ends_at > starts
        and a.starts_at < ends
      union all
      select case when tb.barber_id is null then 'closure' else 'block' end,
        tb.starts_at, tb.ends_at
      from public.time_blocks tb
      where tb.barbershop_id = p_barbershop_id
        and (tb.barber_id is null or tb.barber_id = p_barber_id)
        and tb.ends_at > starts
        and tb.starts_at < ends
    ) o
    order by o.starts_at, o.kind
    limit 1;

    if obstacle.kind is not null then
      free_until := least(greatest(obstacle.starts_at, starts), open_until);
    else
      free_until := open_until;
    end if;

    if ends > free_until then
      if obstacle.kind is not null and greatest(obstacle.starts_at, starts) <= open_until then
        clash := jsonb_build_object(
          'kind', obstacle.kind, 'at', obstacle.starts_at, 'until', obstacle.ends_at);
      else
        clash := jsonb_build_object('kind', 'closing', 'at', open_until, 'until', null);
      end if;
      clash := clash || jsonb_build_object(
        'freeMinutes', floor(extract(epoch from free_until - starts) / 60)::integer,
        'neededMinutes', total_minutes,
        'startsAt', starts);
    end if;
  end if;

  if clash is not null then
    raise exception 'the walk-in does not fit now'
      using errcode = 'P0001', hint = 'walk_in_clash', detail = clash::text;
  end if;

  if customer_name is null then
    insert into public.customers (barbershop_id, full_name, walk_in)
    values (p_barbershop_id, 'Cliente al momento', true)
    returning id into found_customer;
  else
    insert into public.customers (barbershop_id, full_name)
    values (p_barbershop_id, customer_name)
    returning id into found_customer;
  end if;

  begin
    new_id := public.create_appointment(
      p_barbershop_id, found_customer, p_barber_id, starts, p_service_ids, 'walk_in', null
    );
  exception
    when exclusion_violation then
      -- A path that does not take the lock got there first.
      raise exception 'the time was taken'
        using errcode = 'P0001', hint = 'slot_taken';
  end;

  -- Who made it: 'barber' with their account (create_my_walk_in sets the
  -- mark that private.current_actor reads after checking the session) or
  -- 'staff' (the owner). The owner sees it in the appointment.
  insert into public.appointment_events (
    barbershop_id, appointment_id, type, actor, actor_user_id,
    new_status, new_barber_id, new_starts_at, new_ends_at
  ) values (
    p_barbershop_id, new_id, 'created', private.current_actor(), auth.uid(),
    'confirmed', p_barber_id, starts, ends
  );
  return new_id;
end;
$$;

revoke all on function private.create_walk_in_of(uuid, uuid, uuid[], text) from public, anon, authenticated;

-- 3. The professional, with their session ----------------------------------------------------------

create function public.create_my_walk_in(
  p_service_ids uuid[],
  p_customer_name text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barber private.barber_access;
begin
  select * into barber from private.barber_by_session();
  if not found then
    raise exception 'the session is not of a professional'
      using errcode = 'P0001', hint = 'not_professional';
  end if;
  if not barber.writable then
    raise exception 'the barbershop is read only'
      using errcode = 'P0001', hint = 'read_only';
  end if;
  if not barber.barber_active then
    raise exception 'barber is inactive'
      using errcode = 'P0001', hint = 'barber_inactive';
  end if;
  perform set_config('yapoin.actor', 'barber_session', true);

  return private.create_walk_in_of(
    barber.barbershop_id, barber.barber_id, p_service_ids, p_customer_name
  );
end;
$$;

revoke all on function public.create_my_walk_in(uuid[], text) from public, anon, authenticated;
grant execute on function public.create_my_walk_in(uuid[], text) to authenticated;

-- The active services the professional of the session does, for the form.
-- Nothing for a session that is not of a professional with the terms.
create function public.my_services()
returns table (id uuid, name text, duration_minutes integer, price_cop integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.duration_minutes, s.price_cop
  from private.barber_by_session() b
  join public.barber_services bs
    on bs.barbershop_id = b.barbershop_id and bs.barber_id = b.barber_id
  join public.services s
    on s.barbershop_id = bs.barbershop_id and s.id = bs.service_id
  where s.active
  order by lower(s.name), s.id
$$;

revoke all on function public.my_services() from public, anon, authenticated;
grant execute on function public.my_services() to authenticated;

-- 4. The owner, choosing the professional ----------------------------------------------------------

create function public.create_walk_in_appointment(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_service_ids uuid[],
  p_customer_name text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.owner_reaches(p_barbershop_id) then
    raise exception 'unknown barbershop'
      using errcode = 'P0002', hint = 'not_found';
  end if;
  -- The owner's: 'staff' in the history. The professional's mark is local to
  -- the transaction, so it is cleared here: a professional's call earlier in
  -- the same transaction never makes the owner's walk-in a 'barber' one.
  perform set_config('yapoin.actor', '', true);
  return private.create_walk_in_of(p_barbershop_id, p_barber_id, p_service_ids, p_customer_name);
end;
$$;

revoke all on function public.create_walk_in_appointment(uuid, uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.create_walk_in_appointment(uuid, uuid, uuid[], text) to authenticated;
