-- Multi-location from the first version: an owner opens another barbershop
-- from the same account. The free trial belongs to the company (the account),
-- not to each location: new locations share the trial of the owner's first
-- barbershop. Each location keeps its own link, data and subscription.
-- See docs/decisiones/0006-esquema-base-de-datos-final.md.

create function private.today_bogota()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date
$$;

-- Free trial: the signup day in Bogotá plus 20 full days. The literal stays in
-- this form because trial.test.ts compares it with TRIAL_DAYS.
create function private.new_trial_expires_on()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date + 20
$$;

-- barbershops.trial_ends_on: last day of the free trial of this barbershop.
-- Without payments, the trial ends on expires_on; with payments (dev data
-- only), on the creation day plus 20 days.
alter table public.barbershops add column trial_ends_on date;

update public.barbershops b
set trial_ends_on = case
  when exists (select 1 from public.subscription_payments s where s.barbershop_id = b.id)
    then (b.created_at at time zone 'America/Bogota')::date + 20
  else b.expires_on
end;

alter table public.barbershops
  alter column trial_ends_on set not null,
  add constraint barbershops_expiry_after_trial check (expires_on >= trial_ends_on);

-- A new barbershop starts with expires_on = end of its trial; this copies it
-- when the insert does not say otherwise.
create function private.set_trial_ends_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.trial_ends_on := coalesce(new.trial_ends_on, new.expires_on);
  return new;
end;
$$;

create trigger set_trial_ends_on
  before insert on public.barbershops
  for each row execute function private.set_trial_ends_on();

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
    private.new_trial_expires_on()
  )
  returning id into new_barbershop_id;

  insert into public.profiles (id, full_name, phone)
  values (new.id, btrim(meta ->> 'owner_name'), meta ->> 'phone');

  insert into public.memberships (user_id, barbershop_id, role)
  values (new.id, new_barbershop_id, 'owner');

  return new;
end;
$$;

-- Another barbershop for the signed-in owner. It shares the trial of the
-- owner's first barbershop; created after that trial ended, it takes no
-- bookings until its first payment (see private.barbershop_phase).
-- Format, reserved words and uniqueness of the slug are enforced by the
-- barbershops constraints: 23505 means the link is taken, 23514 that it is
-- invalid or reserved.
create function public.create_barbershop(
  p_name text,
  p_slug text,
  p_whatsapp_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_phone text;
  company_trial_ends_on date;
  new_barbershop_id uuid;
begin
  -- Only an active owner of at least one barbershop; never a super admin.
  select p.phone into caller_phone
  from public.profiles p
  where p.id = caller
    and p.active
    and not p.is_super_admin;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- The company trial: the one of the owner's first barbershop.
  select b.trial_ends_on into company_trial_ends_on
  from public.memberships m
  join public.barbershops b on b.id = m.barbershop_id
  where m.user_id = caller
    and m.role = 'owner'
  order by b.created_at, b.id
  limit 1;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  if p_whatsapp_phone is not null and p_whatsapp_phone !~ '^\+573[0-9]{9}$' then
    raise exception 'invalid phone'
      using errcode = 'check_violation', hint = 'phone_invalid';
  end if;

  insert into public.barbershops (name, slug, whatsapp_phone, trial_ends_on, expires_on)
  values (
    btrim(p_name),
    p_slug,
    coalesce(p_whatsapp_phone, caller_phone),
    company_trial_ends_on,
    company_trial_ends_on
  )
  returning id into new_barbershop_id;

  insert into public.memberships (user_id, barbershop_id, role)
  values (caller, new_barbershop_id, 'owner');

  return new_barbershop_id;
end;
$$;

revoke all on function public.create_barbershop(text, text, text) from public;
grant execute on function public.create_barbershop(text, text, text) to authenticated;
