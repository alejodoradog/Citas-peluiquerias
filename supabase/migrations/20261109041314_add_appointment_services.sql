-- Several services in one booking (founder): the appointment stays ONE time
-- block with ONE barber; its lines live in appointment_services.
-- - Each line copies the service price and duration when it is added, and has
--   its position (1 to 5). The same service cannot repeat in an appointment
--   (it is part of the primary key).
-- - At commit, a deferred constraint trigger checks every touched appointment:
--   1 to 5 lines, total duration <= 480 minutes, ends_at = starts_at + total,
--   price_cop = sum of the lines, and its barber offers every service.
--   The no-overlap exclusion keeps working on the whole range.
-- - appointments.service_id goes away: the lines are the only source.
-- - Create with public.create_appointment and change the services with
--   public.change_appointment_services (both security invoker: RLS applies).
-- See docs/decisiones/0006-esquema-base-de-datos-final.md.

create table public.appointment_services (
  barbershop_id uuid not null default private.current_barbershop_id(),
  appointment_id uuid not null,
  position smallint not null check (position between 1 and 5),
  service_id uuid not null,
  -- Copies taken from the service when the line is added.
  price_cop integer not null check (price_cop >= 0),
  duration_minutes integer not null check (duration_minutes between 1 and 720),
  created_at timestamptz not null default now(),
  -- The same service cannot repeat in an appointment.
  primary key (barbershop_id, appointment_id, service_id),
  -- Deferred, so change_appointment_services can reorder in one statement.
  constraint appointment_services_position_key
    unique (barbershop_id, appointment_id, position) deferrable initially deferred,
  foreign key (barbershop_id, appointment_id)
    references public.appointments (barbershop_id, id) on delete restrict,
  foreign key (barbershop_id, service_id)
    references public.services (barbershop_id, id) on delete restrict
);

create index appointment_services_service_idx
  on public.appointment_services (barbershop_id, service_id);

alter table public.appointment_services enable row level security;

-- One line per existing appointment, from its current service, price and length.
insert into public.appointment_services (
  barbershop_id, appointment_id, position, service_id, price_cop, duration_minutes
)
select a.barbershop_id, a.id, 1, a.service_id, a.price_cop,
  (extract(epoch from (a.ends_at - a.starts_at)) / 60)::integer
from public.appointments a;

drop index public.appointments_service_idx;
alter table public.appointments drop column service_id;

-- Lines copy price and duration from an active service of the same barbershop.
create function private.set_appointment_service_copy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select s.price_cop, s.duration_minutes
  into new.price_cop, new.duration_minutes
  from public.services s
  where s.barbershop_id = new.barbershop_id
    and s.id = new.service_id
    and s.active;
  if not found then
    raise exception 'service is inactive or unknown'
      using errcode = 'check_violation', hint = 'service_inactive';
  end if;
  return new;
end;
$$;

create trigger set_appointment_service_copy
  before insert on public.appointment_services
  for each row execute function private.set_appointment_service_copy();

-- Checked at commit, once the appointment and its lines are all written.
create function private.check_appointment_lines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_barbershop uuid;
  target_appointment uuid;
  appt public.appointments;
  line_count integer;
  total_minutes integer;
  total_price integer;
begin
  if tg_table_name = 'appointments' then
    target_barbershop := new.barbershop_id;
    target_appointment := new.id;
  elsif tg_op = 'DELETE' then
    target_barbershop := old.barbershop_id;
    target_appointment := old.appointment_id;
  else
    target_barbershop := new.barbershop_id;
    target_appointment := new.appointment_id;
  end if;

  select * into appt
  from public.appointments a
  where a.barbershop_id = target_barbershop
    and a.id = target_appointment;
  if not found then
    return null;
  end if;

  select count(*), coalesce(sum(l.duration_minutes), 0), coalesce(sum(l.price_cop), 0)
  into line_count, total_minutes, total_price
  from public.appointment_services l
  where l.barbershop_id = target_barbershop
    and l.appointment_id = target_appointment;

  if line_count < 1 then
    raise exception 'an appointment needs at least one service'
      using errcode = 'check_violation', hint = 'services_required';
  end if;
  if total_minutes > 480 then
    raise exception 'appointment longer than 480 minutes'
      using errcode = 'check_violation', hint = 'appointment_too_long';
  end if;
  if appt.ends_at <> appt.starts_at + make_interval(mins => total_minutes)
    or appt.price_cop <> total_price then
    raise exception 'appointment length or price does not match its services'
      using errcode = 'check_violation', hint = 'appointment_totals_mismatch';
  end if;
  if exists (
    select 1
    from public.appointment_services l
    where l.barbershop_id = target_barbershop
      and l.appointment_id = target_appointment
      and not exists (
        select 1
        from public.barber_services bs
        where bs.barbershop_id = target_barbershop
          and bs.barber_id = appt.barber_id
          and bs.service_id = l.service_id
      )
  ) then
    raise exception 'the barber does not offer every service'
      using errcode = 'check_violation', hint = 'barber_does_not_offer_service';
  end if;

  return null;
end;
$$;

create constraint trigger check_appointment_lines
  after insert or update of starts_at, ends_at, price_cop, barber_id on public.appointments
  deferrable initially deferred
  for each row execute function private.check_appointment_lines();

create constraint trigger check_appointment_lines
  after insert or delete on public.appointment_services
  deferrable initially deferred
  for each row execute function private.check_appointment_lines();

-- Rescheduling sends only the new start (and barber): the length is kept.
create function private.keep_appointment_length()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at and new.ends_at = old.ends_at then
    new.ends_at := new.starts_at + (old.ends_at - old.starts_at);
  end if;
  return new;
end;
$$;

create trigger keep_appointment_length
  before update of starts_at on public.appointments
  for each row execute function private.keep_appointment_length();

-- History of line changes after creation. create_appointment marks the new
-- appointment with yapoin.new_appointment so its first lines are not logged.
create function private.log_appointment_service_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  line public.appointment_services;
begin
  if tg_op = 'DELETE' then
    line := old;
  else
    line := new;
  end if;

  if current_setting('yapoin.new_appointment', true) = line.appointment_id::text then
    return null;
  end if;

  insert into public.appointment_events (
    barbershop_id, appointment_id, type, actor, actor_user_id, service_id
  ) values (
    line.barbershop_id,
    line.appointment_id,
    case when tg_op = 'DELETE' then 'service_removed' else 'service_added' end::public.appointment_event_type,
    private.current_actor(),
    auth.uid(),
    line.service_id
  );
  return null;
end;
$$;

create trigger log_appointment_service_change
  after insert or delete on public.appointment_services
  for each row execute function private.log_appointment_service_change();

-- Creation: one call writes the appointment and its lines; length and price
-- come from the services. The panel creates manual appointments only; the
-- public booking function (3.3, security definer) calls it with source web.
create function public.create_appointment(
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
  total_minutes integer;
  total_price integer;
  new_id uuid;
begin
  if auth.uid() is not null and p_source <> 'manual' then
    raise exception 'staff create manual appointments only'
      using errcode = 'insufficient_privilege', hint = 'source_not_allowed';
  end if;
  if coalesce(cardinality(p_service_ids), 0) not between 1 and 5 then
    raise exception 'between 1 and 5 services'
      using errcode = 'check_violation', hint = 'services_required';
  end if;

  select sum(s.duration_minutes), sum(s.price_cop)
  into total_minutes, total_price
  from public.services s
  where s.barbershop_id = p_barbershop_id
    and s.id = any (p_service_ids);

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

-- Change the services of a confirmed or attended appointment (the barber may
-- add a service at the chair). Keeps starts_at; length and price follow.
create function public.change_appointment_services(
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
  select a.id, a.barbershop_id, a.status into appt
  from public.appointments a
  where a.id = p_appointment_id;
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

  -- Lines that stay are kept; the rest are removed, new ones are added.
  delete from public.appointment_services l
  where l.barbershop_id = appt.barbershop_id
    and l.appointment_id = appt.id
    and not (l.service_id = any (p_service_ids));

  -- Positions are unique only at commit, so the order is fixed in two steps.
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

revoke all on function public.create_appointment(uuid, uuid, uuid, timestamptz, uuid[], public.appointment_source, text) from public;
revoke all on function public.change_appointment_services(uuid, uuid[]) from public;
grant execute on function public.create_appointment(uuid, uuid, uuid, timestamptz, uuid[], public.appointment_source, text) to authenticated;
grant execute on function public.change_appointment_services(uuid, uuid[]) to authenticated;

-- Lines are read, added and removed (never edited) by members; the functions
-- above are the way to keep the appointment totals right.
grant select, insert, delete on public.appointment_services to authenticated;
-- Renumbering positions inside change_appointment_services.
grant update (position) on public.appointment_services to authenticated;

create policy member_read on public.appointment_services
  for select to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));
create policy member_insert on public.appointment_services
  for insert to authenticated
  with check (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));
create policy member_update on public.appointment_services
  for update to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]))
  with check (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));
create policy member_delete on public.appointment_services
  for delete to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));
create policy super_admin_read on public.appointment_services
  for select to authenticated
  using ((select private.is_super_admin()));
