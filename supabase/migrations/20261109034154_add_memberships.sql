-- Accounts reach barbershops through memberships: one account can run several
-- barbershops (chains) and phase 2 adds roles without rewriting RLS.
-- See docs/decisiones/0006-esquema-base-de-datos-final.md.

create type public.membership_role as enum ('owner');

create table public.memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, barbershop_id)
);

-- Spec: one owner account per barbershop.
create unique index memberships_one_owner_per_barbershop
  on public.memberships (barbershop_id)
  where role = 'owner';

alter table public.memberships enable row level security;

insert into public.memberships (user_id, barbershop_id, role)
select p.id, p.barbershop_id, 'owner'
from public.profiles p
where p.role = 'owner';

alter table public.profiles add column is_super_admin boolean not null default false;
update public.profiles set is_super_admin = (role = 'super_admin');

-- Helpers ------------------------------------------------------------------------

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_super_admin
      and p.active
  )
$$;

-- Every barbershop the caller belongs to, while their profile is active.
-- Policies call it as (select ...), so it runs once per statement.
create function private.member_barbershop_ids()
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
$$;

-- Default for barbershop_id (decision 0005, point 17): only when the caller
-- belongs to exactly one barbershop. With several, the app must send it.
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
  having count(*) = 1
$$;

revoke all on function private.member_barbershop_ids() from public;
grant execute on function private.member_barbershop_ids() to authenticated;

-- Signup: barbershop, profile and owner membership in one transaction --------------

create or replace function private.register_owner_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_barbershop_id uuid;
begin
  -- Accounts created by hand, such as super admins, carry no barbershop.
  if not meta ? 'barbershop_name' then
    return new;
  end if;

  if coalesce(meta ->> 'phone', '') !~ '^\+573[0-9]{9}$' then
    raise exception 'invalid phone for signup'
      using errcode = 'check_violation';
  end if;

  insert into public.barbershops (name, slug, whatsapp_phone, expires_on)
  values (
    btrim(meta ->> 'barbershop_name'),
    meta ->> 'barbershop_slug',
    meta ->> 'phone',
    -- Same rule as trialEndsOn in src/modulos/suscripciones/dominio/trial.ts.
    (now() at time zone 'America/Bogota')::date + 20
  )
  returning id into new_barbershop_id;

  insert into public.profiles (id, full_name, phone)
  values (new.id, btrim(meta ->> 'owner_name'), meta ->> 'phone');

  insert into public.memberships (user_id, barbershop_id, role)
  values (new.id, new_barbershop_id, 'owner');

  return new;
end;
$$;

-- Policies: owner_* (one barbershop) become member_* (any of the caller's) ---------

do $$
declare
  t text;
begin
  foreach t in array array[
    'barbers', 'services', 'barber_services', 'barber_schedules',
    'barbershop_hours', 'holiday_openings', 'time_blocks', 'customers'
  ] loop
    execute format('drop policy owner_read on public.%I', t);
    execute format('drop policy owner_insert on public.%I', t);
    execute format('drop policy owner_update on public.%I', t);
    execute format('drop policy owner_delete on public.%I', t);
    execute format(
      'create policy member_read on public.%I for select to authenticated
         using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]))', t);
    execute format(
      'create policy member_insert on public.%I for insert to authenticated
         with check (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]))', t);
    execute format(
      'create policy member_update on public.%I for update to authenticated
         using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]))
         with check (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]))', t);
    execute format(
      'create policy member_delete on public.%I for delete to authenticated
         using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]))', t);
  end loop;
end;
$$;

drop policy owner_read on public.barbershops;
drop policy owner_update on public.barbershops;
create policy member_read on public.barbershops
  for select to authenticated
  using (id = any ((select private.member_barbershop_ids())::uuid[]));
create policy member_update on public.barbershops
  for update to authenticated
  using (id = any ((select private.member_barbershop_ids())::uuid[]))
  with check (id = any ((select private.member_barbershop_ids())::uuid[]));

drop policy owner_read on public.appointments;
drop policy owner_insert on public.appointments;
drop policy owner_update on public.appointments;
create policy member_read on public.appointments
  for select to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));
create policy member_insert on public.appointments
  for insert to authenticated
  with check (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));
create policy member_update on public.appointments
  for update to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]))
  with check (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));

drop policy owner_read on public.subscription_payments;
create policy member_read on public.subscription_payments
  for select to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));

grant select on public.memberships to authenticated;
create policy own_memberships_read on public.memberships
  for select to authenticated
  using (user_id = (select private.current_profile_id()));
create policy super_admin_read on public.memberships
  for select to authenticated
  using ((select private.is_super_admin()));

-- profiles no longer carries the barbershop or the role ----------------------------

drop index public.profiles_one_owner_per_barbershop;
alter table public.profiles
  drop constraint profiles_role_matches_barbershop,
  drop column barbershop_id,
  drop column role;
drop type public.user_role;
