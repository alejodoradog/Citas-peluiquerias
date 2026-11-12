-- Task 3.4 (docs/tareas/3.4-gestionar-cita.md): "Gestionar mi cita".
--
-- The customer reaches the appointment through its private link,
-- /c/<token>. The token is 32 random bytes; only its SHA-256 is stored
-- (appointments.manage_token_hash, written by book_appointment), so the
-- database never holds a link that works. These three functions are the
-- only way in, all security definer for anon and authenticated, and they
-- receive the hash, never the token:
--
-- 1. managed_appointment(hash): what C-09 shows. One row only while the
--    appointment is confirmed and has not started; nothing otherwise (C-16,
--    "Este link ya no sirve"). The customer's first name only.
-- 2. cancel_appointment_by_token(hash): cancelled_by_customer.
-- 3. reschedule_appointment_by_token(hash, starts_at): the same appointment
--    to another time, same barber and same length (spec, "Reprogramar mueve
--    la misma cita y conserva su duración"). The new time passes the same
--    rules as a public booking (booking_time_problem, barber_slot_problem of
--    add_public_booking) and the barbershop must take bookings.
--
-- Both changes need the policy's notice: until cancellation_notice_hours
-- before the start, the edge included (spec, "hasta X horas antes"). A
-- cancellation also works when the barbershop takes no bookings (decision
-- 0006, "Gestionar mi cita"); moving needs it to take them.
--
-- Decision 0006: the functions set yapoin.actor to 'customer', so the
-- history (log_appointment_event) records who made the change.
--
-- Errors carry a hint the app maps (src/modulos/agenda/datos/manage-errors.ts):
-- link_invalid, too_late, not_accepting, same_time, slot_taken, and the
-- hints of booking_time_problem and barber_slot_problem.

-- 1. managed_appointment ----------------------------------------------------------------------

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
  changeable boolean
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
    now() <= a.starts_at - make_interval(hours => b.cancellation_notice_hours)
  from public.appointments a
  join public.barbershops b on b.id = a.barbershop_id
  join public.barbers br on br.barbershop_id = a.barbershop_id and br.id = a.barber_id
  join public.customers c on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
  where private.is_token_hash(p_token_hash)
    and a.manage_token_hash = p_token_hash
    and a.status = 'confirmed'
    and a.starts_at > now()
    and b.deleted_at is null
$$;

revoke all on function public.managed_appointment(text) from public;
grant execute on function public.managed_appointment(text) to anon, authenticated;

-- 2. The appointment behind a link, locked ------------------------------------------------------
-- The row of a confirmed appointment that has not started, locked for
-- update, or link_invalid; too_late once the notice has passed. Shared by
-- the two changes.

create function private.lock_managed_appointment(p_token_hash text)
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
  where a.manage_token_hash = p_token_hash
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

revoke all on function private.lock_managed_appointment(text) from public;

-- 3. cancel_appointment_by_token ----------------------------------------------------------------

create function public.cancel_appointment_by_token(p_token_hash text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  managed public.appointments;
begin
  perform set_config('yapoin.actor', 'customer', true);
  managed := private.lock_managed_appointment(p_token_hash);

  update public.appointments
  set status = 'cancelled_by_customer'
  where id = managed.id;
end;
$$;

revoke all on function public.cancel_appointment_by_token(text) from public;
grant execute on function public.cancel_appointment_by_token(text) to anon, authenticated;

-- 4. reschedule_appointment_by_token ------------------------------------------------------------

create function public.reschedule_appointment_by_token(
  p_token_hash text,
  p_starts_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  managed public.appointments;
  minutes integer;
  new_end timestamptz;
  problem text;
begin
  perform set_config('yapoin.actor', 'customer', true);
  if p_starts_at is null then
    raise exception 'start required'
      using errcode = 'invalid_parameter_value', hint = 'slot_invalid';
  end if;

  managed := private.lock_managed_appointment(p_token_hash);
  if p_starts_at = managed.starts_at then
    raise exception 'the appointment is already at that time'
      using errcode = 'P0001', hint = 'same_time';
  end if;

  -- The barbershop row as book_appointment takes it: a deletion and this
  -- change run one after the other.
  perform 1
  from public.barbershops b
  where b.id = managed.barbershop_id
    and b.deleted_at is null
  for key share;
  if not found or not public.barbershop_accepts_bookings(managed.barbershop_id) then
    raise exception 'the barbershop takes no bookings'
      using errcode = 'P0001', hint = 'not_accepting';
  end if;

  minutes := (extract(epoch from managed.ends_at - managed.starts_at) / 60)::integer;
  new_end := p_starts_at + make_interval(mins => minutes);

  -- The same lock as a public booking of that barbershop and Bogotá day, so
  -- the two see each other.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'book_appointment:' || managed.barbershop_id::text || ':'
        || ((p_starts_at at time zone 'America/Bogota')::date)::text,
      0
    )
  );

  problem := private.booking_time_problem(managed.barbershop_id, p_starts_at, minutes, now());
  if problem is null then
    problem := private.barber_slot_problem(managed.barbershop_id, managed.barber_id, p_starts_at, new_end);
  end if;
  -- barber_slot_problem counts this same appointment as taking the time;
  -- only another one does.
  if problem = 'slot_taken' and not exists (
    select 1
    from public.appointments a
    where a.barber_id = managed.barber_id
      and a.id <> managed.id
      and a.status in ('confirmed', 'attended', 'no_show')
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, new_end, '[)')
  ) then
    problem := null;
  end if;
  if problem is not null then
    raise exception 'the time cannot be booked'
      using errcode = 'P0001', hint = problem;
  end if;

  -- keep_appointment_length moves ends_at with it.
  begin
    update public.appointments
    set starts_at = p_starts_at
    where id = managed.id;
  exception when exclusion_violation then
    raise exception 'the time was taken'
      using errcode = 'P0001', hint = 'slot_taken';
  end;
end;
$$;

revoke all on function public.reschedule_appointment_by_token(text, timestamptz) from public;
grant execute on function public.reschedule_appointment_by_token(text, timestamptz) to anon, authenticated;

-- 5. The /c/ segment is the app's -----------------------------------------------------------------
-- Like /b/ (the barber's link), /c/<token> cannot be a barbershop link.
-- Keep in sync with RESERVED_SLUGS in src/modulos/barberias/dominio/slug.ts.
alter table public.barbershops
  drop constraint barbershops_slug_not_reserved;
alter table public.barbershops
  add constraint barbershops_slug_not_reserved
  check (slug not in (
    'admin', 'api', 'auth', 'ayuda', 'b', 'c', 'ingresar', 'login', 'nueva-clave',
    'panel', 'privacidad', 'recuperar-clave', 'registro', 'salir', 'soporte',
    'terminos', 'www'
  ));
