-- Task 2.1, setup wizard (D-10 to D-14; docs/tareas/2.1-asistente-de-configuracion.md).
--
-- 1. Services last 5 to 240 minutes, in steps of 5 (spec, "Disponibilidad").
-- 2. barbers.is_owner marks the owner who also cuts ("Yo también corto"; the
--    "Tú" badge of D-12 and D-53). At most one per barbershop.
-- 3. barbers.uses_barbershop_hours: by default a barber works the barbershop
--    hours (spec, registration step 3); its own barber_schedules rows count
--    only when this is false (D-55, task 2.2).
-- 4. complete_barbershop_setup saves the whole wizard in one transaction.

-- 1. Service durations ------------------------------------------------------------------

alter table public.services
  drop constraint services_duration_minutes_check,
  add constraint services_duration_minutes_check
    check (duration_minutes between 5 and 240 and duration_minutes % 5 = 0);

-- 2 and 3. Barbers ------------------------------------------------------------------------

alter table public.barbers
  add column is_owner boolean not null default false,
  add column uses_barbershop_hours boolean not null default true;

create unique index barbers_one_owner_per_barbershop
  on public.barbers (barbershop_id) where is_owner;

-- Barbers that already have their own weekly hours keep them.
update public.barbers b
set uses_barbershop_hours = false
where exists (
  select 1 from public.barber_schedules s
  where s.barbershop_id = b.barbershop_id and s.barber_id = b.id
);

-- The column grants of decision 0002 do not cover new columns. The booking page
-- needs to know whose hours apply; only members see who the owner is.
grant select (uses_barbershop_hours) on public.barbers to anon;
grant select (is_owner, uses_barbershop_hours) on public.barbers to authenticated;

-- 4. The wizard ----------------------------------------------------------------------------
-- Security invoker: RLS and the column grants of the caller apply to every
-- insert. p_services and p_barbers come from the wizard draft:
--   p_hours    [{weekday, start_time, end_time}]           used only without hours
--   p_services [{key, name, price_cop, duration_minutes}]  1 to 30
--   p_barbers  [{display_name, email, is_owner, service_keys[]}]  0 to 50
-- A barber link hash is random and never returned: task 2.3 issues the link.

create function public.complete_barbershop_setup(
  p_barbershop_id uuid,
  p_hours jsonb,
  p_services jsonb,
  p_barbers jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  service_ids jsonb := '{}';
  item jsonb;
  position bigint;
  new_id uuid;
  service_key text;
  owner_flag boolean;
begin
  if not (p_barbershop_id = any (private.member_barbershop_ids())) then
    raise exception 'not a member of this barbershop'
      using errcode = 'insufficient_privilege', hint = 'not_member';
  end if;

  -- Two taps on "Terminar" run one after the other: the second one finds the
  -- services of the first.
  perform 1 from public.barbershops where id = p_barbershop_id for update;
  if exists (select 1 from public.services s where s.barbershop_id = p_barbershop_id) then
    raise exception 'the barbershop is already set up'
      using errcode = 'check_violation', hint = 'setup_done';
  end if;

  if jsonb_typeof(p_services) is distinct from 'array'
     or jsonb_array_length(p_services) not between 1 and 30 then
    raise exception 'between 1 and 30 services'
      using errcode = 'check_violation', hint = 'services_required';
  end if;
  if jsonb_typeof(p_barbers) is distinct from 'array'
     or jsonb_array_length(p_barbers) > 50 then
    raise exception 'at most 50 barbers'
      using errcode = 'check_violation', hint = 'too_many_barbers';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_services) s
    group by lower(btrim(s ->> 'name'))
    having count(*) > 1
  ) then
    raise exception 'two services share a name'
      using errcode = 'check_violation', hint = 'service_name_taken';
  end if;

  if not exists (select 1 from public.barbershop_hours h where h.barbershop_id = p_barbershop_id)
     and jsonb_typeof(p_hours) = 'array' then
    insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
    select p_barbershop_id, (h ->> 'weekday')::smallint, (h ->> 'start_time')::time, (h ->> 'end_time')::time
    from jsonb_array_elements(p_hours) h;
  end if;

  for item in select value from jsonb_array_elements(p_services) loop
    insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values (
      p_barbershop_id,
      btrim(item ->> 'name'),
      (item ->> 'price_cop')::integer,
      (item ->> 'duration_minutes')::integer
    )
    returning id into new_id;
    service_ids := service_ids || jsonb_build_object(item ->> 'key', new_id);
  end loop;

  for item, position in
    select value, ordinality from jsonb_array_elements(p_barbers) with ordinality
  loop
    if jsonb_typeof(item -> 'service_keys') is distinct from 'array'
       or jsonb_array_length(item -> 'service_keys') = 0 then
      raise exception 'each barber does at least one service'
        using errcode = 'check_violation', hint = 'barber_services_required';
    end if;
    owner_flag := coalesce((item ->> 'is_owner')::boolean, false);

    insert into public.barbers (
      barbershop_id, display_name, email, is_owner, link_active, sort_order, link_token_hash
    ) values (
      p_barbershop_id,
      btrim(item ->> 'display_name'),
      nullif(lower(btrim(item ->> 'email')), ''),
      owner_flag,
      -- The owner sees the whole agenda: no private link (D-53).
      not owner_flag,
      position - 1,
      encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex')
    )
    returning id into new_id;

    for service_key in select jsonb_array_elements_text(item -> 'service_keys') loop
      if not service_ids ? service_key then
        raise exception 'unknown service in the setup'
          using errcode = 'check_violation', hint = 'unknown_service';
      end if;
      insert into public.barber_services (barbershop_id, barber_id, service_id)
      values (p_barbershop_id, new_id, (service_ids ->> service_key)::uuid)
      on conflict do nothing;
    end loop;
  end loop;
end;
$$;

revoke all on function public.complete_barbershop_setup(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.complete_barbershop_setup(uuid, jsonb, jsonb, jsonb) to authenticated;
