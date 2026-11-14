-- "Mis citas" (spec, feature 6, P2; designs C-19 to C-21 by Claude Code with
-- the founder's leave, 2026-11-14): the customer writes their email on the
-- barbershop's page and gets, by email, a link to their upcoming
-- appointments there, with no code (decision 0006 de correo, point 10).
--
-- 1. request_my_appointments (only the app's server, after Turnstile): the
--    screen always answers the same, whether the email exists or not. An
--    email is queued only for a customer with upcoming appointments, at most
--    3 an hour per customer, and the IP is limited like the booking (5 an
--    hour per barbershop).
-- 2. The link lives 24 hours. Like the appointments' links (task 5.3), the
--    Edge Function makes a random token when it sends the email and only its
--    hash is kept (private.customer_links).
-- 3. my_appointments(hash): the upcoming confirmed appointments of that
--    customer in that barbershop, without email or phone.
-- 4. issue_my_appointment_link: from that list, a link of each appointment
--    (/c/<token>, task 3.4), only for an appointment of that customer.
-- 5. The recipient of the new email is the customer of the payload, who must
--    still have an email (a deleted customer, task 4.3, gets nothing).

-- 1. The links and the hits ------------------------------------------------------------------------

create table private.customer_links (
  token_hash text primary key check (private.is_token_hash(token_hash)),
  barbershop_id uuid not null,
  customer_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  foreign key (barbershop_id, customer_id)
    references public.customers (barbershop_id, id) on delete cascade
);

create index customer_links_customer_idx
  on private.customer_links (barbershop_id, customer_id);
create index customer_links_age_idx
  on private.customer_links (expires_at);

alter table private.customer_links enable row level security;
revoke all on private.customer_links from public, anon, authenticated, service_role;

create table private.my_appointments_hits (
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  ip_hash text not null check (private.is_token_hash(ip_hash)),
  created_at timestamptz not null default now()
);

create index my_appointments_hits_lookup
  on private.my_appointments_hits (barbershop_id, ip_hash, created_at);

alter table private.my_appointments_hits enable row level security;
revoke all on private.my_appointments_hits from public, anon, authenticated, service_role;

-- The customer of a barbershop link, while it lives.
create function private.customer_by_link(p_token_hash text)
returns table (barbershop_id uuid, customer_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select l.barbershop_id, l.customer_id
  from private.customer_links l
  join public.barbershops b on b.id = l.barbershop_id
  join public.customers c on c.barbershop_id = l.barbershop_id and c.id = l.customer_id
  where private.is_token_hash(p_token_hash)
    and l.token_hash = p_token_hash
    and l.expires_at > now()
    and b.deleted_at is null
    and c.anonymized_at is null
$$;

revoke all on function private.customer_by_link(text) from public;

-- 2. request_my_appointments ---------------------------------------------------------------------

create function public.request_my_appointments(
  p_barbershop_id uuid,
  p_email text,
  p_client_ip_hash text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  found_customer uuid;
begin
  if p_client_ip_hash is not null then
    if not private.is_token_hash(p_client_ip_hash) then
      raise exception 'malformed ip hash' using errcode = 'invalid_parameter_value';
    end if;
    perform pg_advisory_xact_lock(
      hashtextextended('my_appointments_ip:' || p_barbershop_id::text || ':' || p_client_ip_hash, 0)
    );
    delete from private.my_appointments_hits h where h.created_at < now() - interval '24 hours';
    if (
      select count(*) from private.my_appointments_hits h
      where h.barbershop_id = p_barbershop_id
        and h.ip_hash = p_client_ip_hash
        and h.created_at > now() - interval '1 hour'
    ) >= 5 then
      raise exception 'too many requests from this place'
        using errcode = 'P0001', hint = 'too_many_from_ip';
    end if;
    insert into private.my_appointments_hits (barbershop_id, ip_hash)
    values (p_barbershop_id, p_client_ip_hash);
  end if;

  select c.id into found_customer
  from public.customers c
  join public.barbershops b on b.id = c.barbershop_id
  where c.barbershop_id = p_barbershop_id
    and c.email = lower(btrim(coalesce(p_email, '')))
    and c.anonymized_at is null
    and b.deleted_at is null
    and exists (
      select 1 from public.appointments a
      where a.barbershop_id = c.barbershop_id
        and a.customer_id = c.id
        and a.status = 'confirmed'
        and a.starts_at > now()
    );
  -- Nobody, or nothing upcoming: nothing is sent, and the screen says the
  -- same as when something is.
  if found_customer is null then
    return;
  end if;

  if (
    select count(*) from public.notifications n
    where n.barbershop_id = p_barbershop_id
      and n.type = 'customer_appointments'
      and n.payload ->> 'customer_id' = found_customer::text
      and n.created_at > now() - interval '1 hour'
  ) >= 3 then
    return;
  end if;

  perform private.enqueue_notification(
    p_barbershop_id, 'customer_appointments',
    'my-appointments:' || found_customer || ':' || extract(epoch from clock_timestamp())::text,
    null, now(), jsonb_build_object('customer_id', found_customer));
end;
$$;

revoke all on function public.request_my_appointments(uuid, text, text) from public, anon, authenticated;
grant execute on function public.request_my_appointments(uuid, text, text) to service_role;

-- The Edge Function keeps the hash of the email's link before sending it.
create function public.issue_customer_link(
  p_barbershop_id uuid,
  p_customer_id uuid,
  p_token_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_token_hash(p_token_hash) then
    raise exception 'not a token hash' using errcode = 'invalid_parameter_value';
  end if;
  delete from private.customer_links l where l.expires_at < now() - interval '7 days';
  insert into private.customer_links (token_hash, barbershop_id, customer_id)
  select p_token_hash, c.barbershop_id, c.id
  from public.customers c
  where c.barbershop_id = p_barbershop_id and c.id = p_customer_id
  on conflict (token_hash) do nothing;
  if not found and not exists (
    select 1 from private.customer_links l
    where l.token_hash = p_token_hash
      and l.barbershop_id = p_barbershop_id
      and l.customer_id = p_customer_id
  ) then
    raise exception 'customer not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.issue_customer_link(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.issue_customer_link(uuid, uuid, text) to service_role;

-- 3. my_appointments --------------------------------------------------------------------------------

create function public.my_appointments(p_token_hash text)
returns table (
  barbershop_slug text,
  barbershop_name text,
  customer_first_name text,
  appointment_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  price_cop integer,
  barber_name text,
  service_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.slug,
    b.name,
    split_part(btrim(c.full_name), ' ', 1),
    a.id,
    a.starts_at,
    a.ends_at,
    a.price_cop,
    br.display_name,
    array(
      select s.name
      from public.appointment_services l
      join public.services s on s.barbershop_id = l.barbershop_id and s.id = l.service_id
      where l.barbershop_id = a.barbershop_id and l.appointment_id = a.id
      order by l.position
    )
  from private.customer_by_link(p_token_hash) k
  join public.barbershops b on b.id = k.barbershop_id
  join public.customers c on c.barbershop_id = k.barbershop_id and c.id = k.customer_id
  left join public.appointments a
    on a.barbershop_id = k.barbershop_id
   and a.customer_id = k.customer_id
   and a.status = 'confirmed'
   and a.starts_at > now()
  left join public.barbers br on br.barbershop_id = a.barbershop_id and br.id = a.barber_id
  order by a.starts_at nulls last
$$;

revoke all on function public.my_appointments(text) from public;
grant execute on function public.my_appointments(text) to anon, authenticated;

-- 4. A link of each appointment of the list (task 3.4). At most 20 links per
-- appointment, so a list opened again and again does not grow without end.
create function public.issue_my_appointment_link(
  p_customer_token_hash text,
  p_appointment_id uuid,
  p_token_hash text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner_link record;
begin
  if not private.is_token_hash(p_token_hash) then
    raise exception 'not a token hash' using errcode = 'P0001', hint = 'link_invalid';
  end if;
  select * into owner_link from private.customer_by_link(p_customer_token_hash);
  if not found then
    raise exception 'unknown link' using errcode = 'P0001', hint = 'link_invalid';
  end if;
  if not exists (
    select 1 from public.appointments a
    where a.barbershop_id = owner_link.barbershop_id
      and a.id = p_appointment_id
      and a.customer_id = owner_link.customer_id
      and a.status = 'confirmed'
      and a.starts_at > now()
  ) or (
    select count(*) from private.appointment_links l
    where l.barbershop_id = owner_link.barbershop_id and l.appointment_id = p_appointment_id
  ) >= 20 then
    raise exception 'unknown appointment' using errcode = 'P0001', hint = 'link_invalid';
  end if;
  insert into private.appointment_links (token_hash, barbershop_id, appointment_id)
  values (p_token_hash, owner_link.barbershop_id, p_appointment_id)
  on conflict (token_hash) do nothing;
end;
$$;

revoke all on function public.issue_my_appointment_link(text, uuid, text) from public;
grant execute on function public.issue_my_appointment_link(text, uuid, text) to anon, authenticated;

-- 5. Who receives it --------------------------------------------------------------------------------

create or replace function private.notification_recipient(p_notification_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when n.type in ('appointment_confirmed', 'appointment_reminder',
                    'appointment_cancelled', 'appointment_rescheduled') then (
      select c.email
      from public.appointments a
      join public.customers c on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
      where a.barbershop_id = n.barbershop_id and a.id = n.appointment_id
        and c.anonymized_at is null
    )
    when n.type in ('barber_new_booking', 'barber_booking_cancelled') then (
      select b.email
      from public.appointments a
      join public.barbers b on b.barbershop_id = a.barbershop_id and b.id = a.barber_id
      where a.barbershop_id = n.barbershop_id and a.id = n.appointment_id
        and b.email_notifications
        and b.active
    )
    -- "Mis citas": the customer of the payload, in that barbershop.
    when n.type = 'customer_appointments' then (
      select c.email
      from public.customers c
      where c.barbershop_id = n.barbershop_id
        and c.id::text = n.payload ->> 'customer_id'
        and c.anonymized_at is null
    )
    else (
      select u.email::text
      from public.memberships m
      join auth.users u on u.id = m.user_id
      where m.barbershop_id = n.barbershop_id and m.role = 'owner'
      order by m.created_at, m.user_id
      limit 1
    )
  end
  from public.notifications n
  where n.id = p_notification_id;
$$;
