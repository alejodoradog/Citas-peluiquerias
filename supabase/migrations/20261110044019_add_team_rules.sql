-- Task 2.2, services and barbers (D-50 to D-55; docs/tareas/2.2-servicios-y-barberos.md).
--
-- 1. Barbers are deactivated, never deleted (spec: their history stays), and
--    barbers.deactivated_at says since when (D-53, "Se fue en octubre").
-- 2. Sessions update only the barber columns the panel edits: not the
--    barbershop, the owner mark or the deactivation stamp.
-- 3. set_service_barbers and set_barber_services replace who does what in one
--    step. They touch active rows only, so an inactive service or barber keeps
--    its pairs for when it comes back.
-- 4. set_barber_schedule switches a barber between the barbershop hours and
--    their own (D-55) in one transaction.

-- 1. Deactivation stamp ------------------------------------------------------------------

alter table public.barbers add column deactivated_at timestamptz;
update public.barbers set deactivated_at = updated_at where not active;
alter table public.barbers
  add constraint barbers_deactivated_at_matches check (active = (deactivated_at is null));

create function private.stamp_barber_deactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.active is distinct from old.active then
    new.deactivated_at := case when new.active then null else now() end;
  else
    new.deactivated_at := old.deactivated_at;
  end if;
  return new;
end;
$$;

create trigger stamp_barber_deactivation
  before insert or update on public.barbers
  for each row execute function private.stamp_barber_deactivation();

-- 2. Barber grants -------------------------------------------------------------------------

revoke delete on public.barbers from authenticated;
revoke update on public.barbers from authenticated;
grant update (
  display_name, photo_path, email, email_notifications, link_token_hash,
  link_active, sort_order, active, uses_barbershop_hours
) on public.barbers to authenticated;
grant select (deactivated_at) on public.barbers to authenticated;

-- 3. Who does what ---------------------------------------------------------------------------

create function public.set_service_barbers(p_service_id uuid, p_barber_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shop uuid;
  wanted uuid[] := coalesce(p_barber_ids, '{}');
begin
  select s.barbershop_id into shop from public.services s where s.id = p_service_id for update;
  if shop is null then
    raise exception 'service not found' using errcode = 'P0002', hint = 'service_not_found';
  end if;
  if exists (
    select 1 from unnest(wanted) w (id)
    where not exists (
      select 1 from public.barbers b
      where b.barbershop_id = shop and b.id = w.id and b.active
    )
  ) then
    raise exception 'barber not found' using errcode = 'P0002', hint = 'barber_not_found';
  end if;

  delete from public.barber_services bs
  using public.barbers b
  where bs.barbershop_id = shop and bs.service_id = p_service_id
    and b.barbershop_id = shop and b.id = bs.barber_id and b.active
    and not (bs.barber_id = any (wanted));
  insert into public.barber_services (barbershop_id, barber_id, service_id)
  select distinct shop, w.id, p_service_id from unnest(wanted) w (id)
  on conflict do nothing;
end;
$$;

create function public.set_barber_services(p_barber_id uuid, p_service_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shop uuid;
  wanted uuid[] := coalesce(p_service_ids, '{}');
begin
  select b.barbershop_id into shop from public.barbers b where b.id = p_barber_id for update;
  if shop is null then
    raise exception 'barber not found' using errcode = 'P0002', hint = 'barber_not_found';
  end if;
  if exists (
    select 1 from unnest(wanted) w (id)
    where not exists (
      select 1 from public.services s
      where s.barbershop_id = shop and s.id = w.id and s.active
    )
  ) then
    raise exception 'service not found' using errcode = 'P0002', hint = 'service_not_found';
  end if;

  delete from public.barber_services bs
  using public.services s
  where bs.barbershop_id = shop and bs.barber_id = p_barber_id
    and s.barbershop_id = shop and s.id = bs.service_id and s.active
    and not (bs.service_id = any (wanted));
  insert into public.barber_services (barbershop_id, barber_id, service_id)
  select distinct shop, p_barber_id, w.id from unnest(wanted) w (id)
  on conflict do nothing;
end;
$$;

-- 4. A barber's own hours ------------------------------------------------------------------
-- p_shifts: [{weekday, start, end}], used only when the barber has their own hours.
-- Overlaps fail through barber_schedules_no_overlap and roll everything back.

create function public.set_barber_schedule(
  p_barber_id uuid,
  p_uses_barbershop_hours boolean,
  p_shifts jsonb default '[]'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shop uuid;
begin
  update public.barbers set uses_barbershop_hours = p_uses_barbershop_hours
  where id = p_barber_id
  returning barbershop_id into shop;
  if shop is null then
    raise exception 'barber not found' using errcode = 'P0002', hint = 'barber_not_found';
  end if;

  delete from public.barber_schedules where barbershop_id = shop and barber_id = p_barber_id;
  if not p_uses_barbershop_hours then
    if jsonb_typeof(p_shifts) is distinct from 'array' or jsonb_array_length(p_shifts) > 14 then
      raise exception 'at most 14 shifts' using errcode = 'check_violation', hint = 'shifts_invalid';
    end if;
    insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
    select shop, p_barber_id, (x ->> 'weekday')::smallint, (x ->> 'start')::time, (x ->> 'end')::time
    from jsonb_array_elements(p_shifts) x;
  end if;
end;
$$;

revoke all on function public.set_service_barbers(uuid, uuid[]) from public;
revoke all on function public.set_barber_services(uuid, uuid[]) from public;
revoke all on function public.set_barber_schedule(uuid, boolean, jsonb) from public;
grant execute on function public.set_service_barbers(uuid, uuid[]) to authenticated;
grant execute on function public.set_barber_services(uuid, uuid[]) to authenticated;
grant execute on function public.set_barber_schedule(uuid, boolean, jsonb) to authenticated;
