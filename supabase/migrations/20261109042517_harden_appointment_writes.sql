-- Task 1.9, addendum to decision 0006 after its security and critical reviews.
-- No new business rule: each change makes the database enforce, on every
-- path, a rule the decision already states.
--
-- 1. A super admin never acts as a member, even with a membership by mistake
--    (the accepted risk said "would see"; it also let them write).
-- 2. Sessions update only the appointment columns the panel needs, and
--    create manual appointments only on every path, not only through
--    create_appointment.
-- 3. Bringing a cancelled appointment back is a new occupancy: its barber must
--    be active and offer every service of the appointment.
-- 4. create_appointment tells staff apart by the calling role, so the public
--    booking function (3.3, security definer) works even if the browser has a
--    session; it sums active services only, under a share lock.
-- 5. change_appointment_services locks the appointment first, so two edits, or
--    an edit and a cancellation, run one after the other.
-- 6. Appointment lines are renumbered, never edited, by any role.

-- 1. Super admins are never members ------------------------------------------------

create or replace function private.member_barbershop_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.barbershop_id), '{}')
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid()
    and p.active
    and not p.is_super_admin
$$;

create or replace function private.current_barbershop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (array_agg(m.barbershop_id))[1]
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid()
    and p.active
    and not p.is_super_admin
  having count(*) = 1
$$;

-- 2. Column grants on appointments ---------------------------------------------------
-- source, manage_token_hash, created_at and barbershop_id are set at creation
-- and never by a session afterwards.

revoke update on public.appointments from authenticated;
grant update (customer_id, barber_id, starts_at, ends_at, price_cop, status, deposit_received)
  on public.appointments to authenticated;

-- 2 and 3. Appointment guards ----------------------------------------------------------

create or replace function private.check_appointment_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  becomes_active boolean := tg_op = 'UPDATE'
    and old.status in ('cancelled_by_customer', 'cancelled_by_barbershop')
    and new.status in ('confirmed', 'attended', 'no_show');
begin
  -- New occupancy (insert, a change of barber or time, or a cancelled
  -- appointment coming back) needs an active barber.
  if tg_op = 'INSERT'
    or becomes_active
    or new.barber_id is distinct from old.barber_id
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at then
    if not exists (
      select 1
      from public.barbers b
      where b.barbershop_id = new.barbershop_id
        and b.id = new.barber_id
        and b.active
    ) then
      raise exception 'barber is inactive'
        using errcode = 'check_violation', hint = 'barber_inactive';
    end if;
  end if;

  -- Coming back also needs a barber who still offers every service. Other
  -- changes are checked at commit by check_appointment_lines.
  if becomes_active and exists (
    select 1
    from public.appointment_services l
    where l.barbershop_id = new.barbershop_id
      and l.appointment_id = new.id
      and not exists (
        select 1
        from public.barber_services bs
        where bs.barbershop_id = new.barbershop_id
          and bs.barber_id = new.barber_id
          and bs.service_id = l.service_id
      )
  ) then
    raise exception 'the barber does not offer every service'
      using errcode = 'check_violation', hint = 'barber_does_not_offer_service';
  end if;

  -- Manual appointments may have a customer without email; web ones may not.
  if tg_op = 'INSERT' and new.source = 'web' and not exists (
    select 1
    from public.customers c
    where c.barbershop_id = new.barbershop_id
      and c.id = new.customer_id
      and c.email is not null
  ) then
    raise exception 'web booking needs the customer email'
      using errcode = 'check_violation', hint = 'customer_email_required';
  end if;

  return new;
end;
$$;

-- A session creates manual appointments only, on every path. This trigger is
-- security invoker on purpose: current_user is then the role that inserts
-- (authenticated for a session, the owner of the public booking function in
-- 3.3), which a security definer function cannot see.
create function private.check_appointment_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and new.source <> 'manual' then
    raise exception 'staff create manual appointments only'
      using errcode = 'insufficient_privilege', hint = 'source_not_allowed';
  end if;
  return new;
end;
$$;

grant execute on function private.check_appointment_source() to authenticated;

create trigger check_appointment_source
  before insert on public.appointments
  for each row execute function private.check_appointment_source();

drop trigger check_appointment_rules on public.appointments;
create trigger check_appointment_rules
  before insert or update of barber_id, starts_at, ends_at, status on public.appointments
  for each row execute function private.check_appointment_rules();

-- 4. create_appointment --------------------------------------------------------------

create or replace function public.create_appointment(
  p_barbershop_id uuid,
  p_customer_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz,
  p_service_ids uuid[],
  p_source public.appointment_source default 'manual',
  p_manage_token_hash text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  found_services integer;
  total_minutes integer;
  total_price integer;
  new_id uuid;
begin
  if current_user = 'authenticated' and p_source <> 'manual' then
    raise exception 'staff create manual appointments only'
      using errcode = 'insufficient_privilege', hint = 'source_not_allowed';
  end if;
  if coalesce(cardinality(p_service_ids), 0) not between 1 and 5 then
    raise exception 'between 1 and 5 services'
      using errcode = 'check_violation', hint = 'services_required';
  end if;

  -- The share lock keeps prices and durations still until the lines copy them.
  select count(*), sum(s.duration_minutes), sum(s.price_cop)
  into found_services, total_minutes, total_price
  from (
    select sv.duration_minutes, sv.price_cop
    from public.services sv
    where sv.barbershop_id = p_barbershop_id
      and sv.id = any (p_service_ids)
      and sv.active
    for share
  ) s;
  if found_services <> cardinality(p_service_ids) then
    -- An inactive, unknown or repeated service. A repeated one is reported by
    -- the primary key of the lines instead.
    if found_services <> (select count(distinct sid) from unnest(p_service_ids) as t (sid)) then
      raise exception 'service is inactive or unknown'
        using errcode = 'check_violation', hint = 'service_inactive';
    end if;
  end if;

  insert into public.appointments (
    barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop,
    source, manage_token_hash
  ) values (
    p_barbershop_id, p_customer_id, p_barber_id, p_starts_at,
    p_starts_at + make_interval(mins => coalesce(total_minutes, 0)),
    coalesce(total_price, 0), p_source, p_manage_token_hash
  )
  returning id into new_id;

  perform set_config('yapoin.new_appointment', new_id::text, true);

  insert into public.appointment_services (barbershop_id, appointment_id, position, service_id)
  select p_barbershop_id, new_id, ord::smallint, sid
  from unnest(p_service_ids) with ordinality as t (sid, ord);

  perform set_config('yapoin.new_appointment', '', true);
  return new_id;
end;
$$;

-- 5. change_appointment_services locks the appointment ---------------------------------

create or replace function public.change_appointment_services(
  p_appointment_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  appt record;
  total_minutes integer;
  total_price integer;
begin
  -- Named columns: authenticated cannot read manage_token_hash (decision 0002).
  -- The row lock serializes concurrent edits and cancellations.
  select a.id, a.barbershop_id, a.status into appt
  from public.appointments a
  where a.id = p_appointment_id
  for update;
  if not found then
    raise exception 'appointment not found' using errcode = 'no_data_found';
  end if;
  if appt.status not in ('confirmed', 'attended') then
    raise exception 'only confirmed or attended appointments'
      using errcode = 'check_violation', hint = 'appointment_closed';
  end if;
  if coalesce(cardinality(p_service_ids), 0) not between 1 and 5 then
    raise exception 'between 1 and 5 services'
      using errcode = 'check_violation', hint = 'services_required';
  end if;

  delete from public.appointment_services l
  where l.barbershop_id = appt.barbershop_id
    and l.appointment_id = appt.id
    and not (l.service_id = any (p_service_ids));

  update public.appointment_services l
  set position = t.ord::smallint
  from unnest(p_service_ids) with ordinality as t (sid, ord)
  where l.barbershop_id = appt.barbershop_id
    and l.appointment_id = appt.id
    and l.service_id = t.sid;

  insert into public.appointment_services (barbershop_id, appointment_id, position, service_id)
  select appt.barbershop_id, appt.id, ord::smallint, sid
  from unnest(p_service_ids) with ordinality as t (sid, ord)
  where not exists (
    select 1 from public.appointment_services l
    where l.barbershop_id = appt.barbershop_id
      and l.appointment_id = appt.id
      and l.service_id = t.sid
  );

  select sum(l.duration_minutes), sum(l.price_cop)
  into total_minutes, total_price
  from public.appointment_services l
  where l.barbershop_id = appt.barbershop_id
    and l.appointment_id = appt.id;

  update public.appointments
  set ends_at = starts_at + make_interval(mins => total_minutes),
      price_cop = total_price
  where id = appt.id;
end;
$$;

-- 6. Lines are renumbered, never edited --------------------------------------------------

create function private.keep_appointment_line()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.barbershop_id, new.appointment_id, new.service_id, new.price_cop, new.duration_minutes, new.created_at)
     is distinct from
     (old.barbershop_id, old.appointment_id, old.service_id, old.price_cop, old.duration_minutes, old.created_at) then
    raise exception 'appointment lines can only be renumbered'
      using errcode = 'check_violation', hint = 'appointment_line_locked';
  end if;
  return new;
end;
$$;

create trigger keep_appointment_line
  before update on public.appointment_services
  for each row execute function private.keep_appointment_line();
