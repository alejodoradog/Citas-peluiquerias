-- Barbers leave by deactivation (active = false), never by deletion, so their
-- appointment history stays. An inactive barber's agenda is closed from now
-- on: he disappears from the public page and takes no new or moved
-- appointments and no new blocks. The appointments he already had stay, and
-- they can still be closed, cancelled or reassigned to an active barber.
-- Web bookings always carry the customer's email (the confirmation and the
-- manage link go by email).
-- See docs/decisiones/0006-esquema-base-de-datos-final.md.

create function private.check_appointment_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- New occupancy (insert, or a change of barber or time) needs an active barber.
  if tg_op = 'INSERT'
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

create trigger check_appointment_rules
  before insert or update of barber_id, starts_at, ends_at on public.appointments
  for each row execute function private.check_appointment_rules();

-- No new or moved blocks for an inactive barber. Shop-wide blocks (no barber)
-- are not affected; deleting a block always works.
create function private.check_time_block_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.barber_id is not null
    and (
      tg_op = 'INSERT'
      or new.barber_id is distinct from old.barber_id
      or new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at
    )
    and not exists (
      select 1
      from public.barbers b
      where b.barbershop_id = new.barbershop_id
        and b.id = new.barber_id
        and b.active
    ) then
    raise exception 'barber is inactive'
      using errcode = 'check_violation', hint = 'barber_inactive';
  end if;
  return new;
end;
$$;

create trigger check_time_block_rules
  before insert or update of barber_id, starts_at, ends_at on public.time_blocks
  for each row execute function private.check_time_block_rules();

-- The public page sees schedules, services and blocks of active barbers only
-- (1.2 review). Shop-wide blocks (no barber) stay visible.
drop policy public_read on public.barber_schedules;
create policy public_read on public.barber_schedules
  for select to anon
  using (exists (
    select 1 from public.barbers b
    where b.id = barber_schedules.barber_id and b.active
  ));

drop policy public_read on public.barber_services;
create policy public_read on public.barber_services
  for select to anon
  using (exists (
    select 1 from public.barbers b
    where b.id = barber_services.barber_id and b.active
  ));

drop policy public_read on public.time_blocks;
create policy public_read on public.time_blocks
  for select to anon
  using (
    time_blocks.barber_id is null
    or exists (
      select 1 from public.barbers b
      where b.id = time_blocks.barber_id and b.active
    )
  );
