-- Task 3.5 (docs/tareas/3.5-anti-abuso.md): limits on public bookings.
--
-- Turnstile (task 3.5) stops bots in the app's server, but book_appointment
-- was callable by anyone with the publishable key, so a script could skip
-- it. From here on:
--
-- 1. Only the app's server books (service_role), through
--    book_appointment_from_app, after checking Turnstile. anon and
--    authenticated no longer execute book_appointment.
-- 2. At most 10 public bookings per hour from one IP in one barbershop
--    (founder, 2026-11-12). The app sends a keyed hash of the IP, never the
--    IP; the hits are kept 24 hours.
-- 3. At most 5 upcoming web appointments per customer (that is, per email)
--    in one barbershop (founder, 2026-11-12), enforced by a trigger, so it
--    holds whatever path books. Manual appointments of the panel do not
--    count against it and are not limited.
--
-- Errors carry a hint the app maps (src/modulos/agenda/datos/booking-errors.ts):
-- too_many_from_ip, too_many_upcoming.

-- 1. Constants, compared with src/modulos/agenda/dominio/booking-limits.ts -------------

create function private.max_bookings_per_ip_hour()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

create function private.max_upcoming_web_per_customer()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

revoke all on function private.max_bookings_per_ip_hour() from public;
revoke all on function private.max_upcoming_web_per_customer() from public;

-- 2. Upcoming web appointments per customer ----------------------------------------------

create function private.limit_upcoming_web_appointments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source <> 'web' then
    return new;
  end if;
  -- Two bookings with the same email run one after the other.
  perform 1
  from public.customers c
  where c.barbershop_id = new.barbershop_id
    and c.id = new.customer_id
  for update;
  if (
    select count(*)
    from public.appointments a
    where a.barbershop_id = new.barbershop_id
      and a.customer_id = new.customer_id
      and a.source = 'web'
      and a.status = 'confirmed'
      and a.starts_at > now()
  ) >= private.max_upcoming_web_per_customer() then
    raise exception 'too many upcoming appointments for this customer'
      using errcode = 'P0001', hint = 'too_many_upcoming';
  end if;
  return new;
end;
$$;

revoke all on function private.limit_upcoming_web_appointments() from public;

create trigger limit_upcoming_web_appointments
  before insert on public.appointments
  for each row execute function private.limit_upcoming_web_appointments();

-- 3. Bookings per IP ----------------------------------------------------------------------
-- Only the hash of the IP (HMAC-SHA256 with a server secret, 64 hex), the
-- barbershop and the moment. Nobody reads it through the API.

create table private.booking_ip_hits (
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  ip_hash text not null check (private.is_token_hash(ip_hash)),
  created_at timestamptz not null default now()
);

alter table private.booking_ip_hits enable row level security;

create index booking_ip_hits_lookup
  on private.booking_ip_hits (barbershop_id, ip_hash, created_at);
create index booking_ip_hits_age
  on private.booking_ip_hits (created_at);

-- 4. book_appointment_from_app ----------------------------------------------------------
-- The public booking as the app's server makes it: the IP limit, then
-- book_appointment with the same arguments. p_client_ip_hash null (no IP
-- known, as in local development) skips the IP limit.

create function public.book_appointment_from_app(
  p_barbershop_id uuid,
  p_starts_at timestamptz,
  p_service_ids uuid[],
  p_customer_name text,
  p_customer_email text,
  p_manage_token_hash text,
  p_barber_id uuid default null,
  p_customer_phone text default null,
  p_client_ip_hash text default null
)
returns table (appointment_id uuid, barber_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_client_ip_hash is not null then
    if not private.is_token_hash(p_client_ip_hash) then
      raise exception 'malformed ip hash'
        using errcode = 'invalid_parameter_value', hint = 'slot_invalid';
    end if;
    -- One booking at a time per barbershop and IP, so the count holds.
    perform pg_advisory_xact_lock(
      hashtextextended('booking_ip:' || p_barbershop_id::text || ':' || p_client_ip_hash, 0)
    );
    delete from private.booking_ip_hits h
    where h.created_at < now() - interval '24 hours';
    if (
      select count(*)
      from private.booking_ip_hits h
      where h.barbershop_id = p_barbershop_id
        and h.ip_hash = p_client_ip_hash
        and h.created_at > now() - interval '1 hour'
    ) >= private.max_bookings_per_ip_hour() then
      raise exception 'too many bookings from this place'
        using errcode = 'P0001', hint = 'too_many_from_ip';
    end if;
  end if;

  return query
  select b.appointment_id, b.barber_id
  from public.book_appointment(
    p_barbershop_id => p_barbershop_id,
    p_starts_at => p_starts_at,
    p_service_ids => p_service_ids,
    p_customer_name => p_customer_name,
    p_customer_email => p_customer_email,
    p_manage_token_hash => p_manage_token_hash,
    p_barber_id => p_barber_id,
    p_customer_phone => p_customer_phone
  ) b;

  if p_client_ip_hash is not null then
    insert into private.booking_ip_hits (barbershop_id, ip_hash)
    values (p_barbershop_id, p_client_ip_hash);
  end if;
end;
$$;

revoke all on function public.book_appointment_from_app(uuid, timestamptz, uuid[], text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.book_appointment_from_app(uuid, timestamptz, uuid[], text, text, text, uuid, text, text) to service_role;

-- 5. book_appointment is no longer public ------------------------------------------------

revoke execute on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text) from anon, authenticated;
grant execute on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text, uuid, text) to service_role;
