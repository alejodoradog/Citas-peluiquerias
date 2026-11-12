-- Task 4.3 (docs/tareas/4.3-clientes.md): "Clientes" in the panel, and
-- "Borrar cliente" (D-42) under Ley 1581.
--
-- Deleting a customer cannot delete the row while appointments point at it
-- (appointments.customer_id is on delete restrict, and the visits are the
-- barbershop's accounts). So the row is anonymized: no name, email, phone
-- or notes, and anonymized_at says when. The appointments stay, and every
-- screen shows them as "Cliente borrado". A customer with no appointment at
-- all is really deleted.
--
-- Provisional decisions K1-K5 of task 4.3 (K6 is in list_customers):
-- - K1. Not while the customer has an appointment still to come (confirmed
--   and not over): it is cancelled first, as for a sede (task 2.6b). So no
--   link of "Gestionar mi cita" of theirs still works: managed_appointment
--   shows only confirmed appointments that have not started.
-- - K2. The name becomes 'Cliente borrado' in the row too, so a screen that
--   reads full_name (the agenda of task 4.1) never shows the old one. The
--   check below keeps an anonymized row without data, and the trigger keeps
--   it that way: nobody edits it afterwards.
-- - K3. The email goes, so the unique (barbershop_id, email) frees it: a
--   later public booking with the same email creates a new customer
--   (book_appointment inserts on conflict do nothing). The check that web
--   appointments have an email (check_appointment_rules) runs on insert
--   only, so the old web appointments stay valid.
-- - K4. No new appointment for an anonymized customer, nor one moved to
--   them, nor a cancelled one of theirs brought back.
-- - K5. Allowed in every phase of the subscription: suspension never holds
--   back a deletion that Ley 1581 grants.
--
-- Members do it through anonymize_customer (security invoker: RLS decides
-- whose customers they reach). A direct update that sets anonymized_at
-- meets the same rules in the trigger, so there is no way around them.
--
-- Races: the trigger locks the customer row FOR UPDATE before it looks for
-- appointments to come, and check_appointment_customer locks it FOR KEY
-- SHARE (the lock its foreign key takes anyway) before it reads
-- anonymized_at. A booking that inserted first is seen by the check; one
-- that inserts during the anonymization waits for it and then sees the
-- anonymized row.
--
-- list_customers (D-40): the list with its counts, search and filters, in
-- one query. Security invoker: RLS keeps it to the caller's barbershops.

-- 1. The mark -----------------------------------------------------------------------------------

alter table public.customers
  add column anonymized_at timestamptz,
  add constraint customers_anonymized_has_no_data check (
    anonymized_at is null
    or (full_name = 'Cliente borrado' and email is null and phone is null and notes is null)
  );

-- 2. The rules of the mark ------------------------------------------------------------------------

create function private.guard_customer_anonymization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.anonymized_at is not null then
      raise exception 'a new customer is not anonymized'
        using errcode = 'check_violation', hint = 'customer_anonymized';
    end if;
    return new;
  end if;

  -- K2: an anonymized customer stays as it is.
  if old.anonymized_at is not null then
    raise exception 'the customer was deleted'
      using errcode = 'check_violation', hint = 'customer_anonymized';
  end if;

  if new.anonymized_at is not null then
    -- See the header: bookings of this customer wait for this lock, and the
    -- check below sees those that committed before it.
    perform 1
    from public.customers c
    where c.barbershop_id = old.barbershop_id
      and c.id = old.id
    for update;

    -- K1.
    if exists (
      select 1
      from public.appointments a
      where a.barbershop_id = old.barbershop_id
        and a.customer_id = old.id
        and a.status = 'confirmed'
        and a.ends_at > now()
    ) then
      raise exception 'the customer has upcoming appointments'
        using errcode = 'check_violation', hint = 'has_upcoming_appointments';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_customer_anonymization() from public;

create trigger guard_customer_anonymization
  before insert or update on public.customers
  for each row execute function private.guard_customer_anonymization();

-- K4.
create function private.check_appointment_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_anonymized_at timestamptz;
begin
  if tg_op = 'INSERT'
    or new.customer_id is distinct from old.customer_id
    or (old.status in ('cancelled_by_customer', 'cancelled_by_barbershop')
        and new.status in ('confirmed', 'attended', 'no_show')) then
    select c.anonymized_at into customer_anonymized_at
    from public.customers c
    where c.barbershop_id = new.barbershop_id
      and c.id = new.customer_id
    for key share;
    if customer_anonymized_at is not null then
      raise exception 'the customer was deleted'
        using errcode = 'check_violation', hint = 'customer_anonymized';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.check_appointment_customer() from public;

create trigger check_appointment_customer
  before insert or update of customer_id, status on public.appointments
  for each row execute function private.check_appointment_customer();

-- 3. anonymize_customer -----------------------------------------------------------------------------
-- D-42 "Borrar cliente". customer_not_found when the caller does not reach
-- the customer (another barbershop's, or already deleted); the hints of the
-- trigger otherwise.

create function public.anonymize_customer(p_barbershop_id uuid, p_customer_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.customers c
  where c.barbershop_id = p_barbershop_id
    and c.id = p_customer_id
    and c.anonymized_at is null
  for update;
  if not found then
    raise exception 'unknown customer'
      using errcode = 'P0002', hint = 'customer_not_found';
  end if;

  -- Nothing points at it: the row goes (Ley 1581, nothing left to keep).
  if not exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.customer_id = p_customer_id
  ) then
    delete from public.customers c
    where c.barbershop_id = p_barbershop_id
      and c.id = p_customer_id;
    return;
  end if;

  update public.customers c
  set full_name = 'Cliente borrado',
      email = null,
      phone = null,
      notes = null,
      anonymized_at = now()
  where c.barbershop_id = p_barbershop_id
    and c.id = p_customer_id;
end;
$$;

revoke all on function public.anonymize_customer(uuid, uuid) from public;
grant execute on function public.anonymize_customer(uuid, uuid) to authenticated;

-- 4. list_customers ---------------------------------------------------------------------------------
-- D-40. One row per customer who was not deleted, in alphabetical order:
-- - visits: attended appointments; no_shows: "no asistió" (spec,
--   Inasistencias: counted from the appointments, never stored);
-- - last_visit_at: the start of the last attended one;
-- - next_appointment_at: the start of the next confirmed one.
-- p_search matches the name or the email, without case or accents, or the
-- phone by its digits (3 or more). Accents are folded by hand: lower()
-- depends on the locale, translate() does not. p_filter: all, no_shows (1
-- or more) or new (K6: created in the last 30 days). At most p_limit rows
-- (1-200).

create function public.list_customers(
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
security invoker
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

revoke all on function public.list_customers(uuid, text, text, integer) from public;
grant execute on function public.list_customers(uuid, text, text, integer) to authenticated;
