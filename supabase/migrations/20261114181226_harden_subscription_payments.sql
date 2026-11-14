-- Task 5.4b (docs/tareas/5.4b-correcciones-plataforma.md): the findings of the
-- security review of task 5.4 (migration add_subscription_payment_flow).
--
-- 1. M1: a payment is registered once. Two tabs, the back button or a retry
--    of the network could register the same transfer twice, and each copy
--    added a month nobody paid. A non-voided payment of a barbershop now has
--    a method and reference of its own; voiding the wrong one frees them.
-- 2. B1: voiding names the barbershop too, so a payment is only voided from
--    the record of its own barbershop.
-- 3. B2 and B3: the rules the app already followed are now the database's:
--    - the payment day goes from today back 31 days, never before the day
--      the barbershop was created, never in the future (decision P8);
--    - a trial is extended 30 days at most past its end, or past today if it
--      already ended (decision P3);
--    - a deleted barbershop is never paid, voided, suspended, reactivated or
--      extended.
-- 4. B4: an owner reads their payments, but not the platform's trace: who
--    registered or voided one, and why. The super admin reads it through
--    platform_payments.
-- 5. B5: the guard of the ledger. Voiding needs the super admin's own
--    session, recorded as who voided it; and no API role updates, deletes or
--    truncates a payment any more (service_role kept them by default), so
--    only the functions of this ledger change a row.

-- 1. Once per method and reference -------------------------------------------------

create unique index subscription_payments_reference_once
  on public.subscription_payments (barbershop_id, method, lower(btrim(reference)))
  where voided_at is null;

-- 3 (B2, B3) and 1: register_subscription_payment, same signature.
create or replace function public.register_subscription_payment(
  p_barbershop_id uuid,
  p_plan text,
  p_method public.payment_method,
  p_reference text,
  p_paid_on date default null
)
returns public.subscription_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen public.plans;
  shop public.barbershops;
  today date := private.today_bogota();
  paid date := coalesce(p_paid_on, private.today_bogota());
  payment_id uuid;
  payment public.subscription_payments;
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- The barbershop first, the same lock order as voiding and the triggers.
  select * into shop
  from public.barbershops
  where id = p_barbershop_id and deleted_at is null
  for update;
  if not found then
    raise exception 'barbershop not found' using errcode = 'no_data_found';
  end if;

  select * into chosen from public.plans where code = p_plan and active;
  if not found then
    raise exception 'unknown plan' using errcode = 'invalid_parameter_value';
  end if;

  if paid > today
    or paid < greatest(today - 31, (shop.created_at at time zone 'America/Bogota')::date) then
    raise exception 'payment day out of range'
      using errcode = 'invalid_parameter_value', hint = 'payment_day_out_of_range';
  end if;

  begin
    insert into public.subscription_payments (
      barbershop_id, plan, amount_cop, method, reference, paid_on, registered_by
    ) values (
      p_barbershop_id,
      chosen.code,
      chosen.monthly_price_cop,
      p_method,
      btrim(p_reference),
      paid,
      auth.uid()
    )
    returning id into payment_id;
  exception when unique_violation then
    raise exception 'payment already registered'
      using errcode = 'unique_violation', hint = 'payment_already_registered';
  end;

  -- Read after the recompute, which may have settled covers_*.
  select * into payment from public.subscription_payments where id = payment_id;
  return payment;
end;
$$;

-- 2 (B1): voiding names the barbershop. A new signature, so the old one goes.
drop function public.void_subscription_payment(uuid, text);

create function public.void_subscription_payment(
  p_barbershop_id uuid,
  p_payment_id uuid,
  p_reason text
)
returns public.subscription_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.subscription_payments;
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- Lock the barbershop first, in the same order as registering a payment.
  perform 1
  from public.barbershops b
  where b.id = p_barbershop_id and b.deleted_at is null
  for update;
  if not found then
    raise exception 'barbershop not found' using errcode = 'no_data_found';
  end if;

  update public.subscription_payments
  set voided_at = now(),
      voided_by = auth.uid(),
      void_reason = btrim(p_reason)
  where id = p_payment_id
    and barbershop_id = p_barbershop_id
    and voided_at is null;
  if not found then
    raise exception 'payment not found or already voided' using errcode = 'no_data_found';
  end if;

  select * into payment from public.subscription_payments where id = p_payment_id;
  return payment;
end;
$$;

revoke all on function public.void_subscription_payment(uuid, uuid, text) from public;
grant execute on function public.void_subscription_payment(uuid, uuid, text) to authenticated;

-- 3 (B2): never on a deleted barbershop.
create or replace function public.suspend_barbershop(p_barbershop_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.barbershops set subscription_status = 'suspended'
  where id = p_barbershop_id and deleted_at is null;
  if not found then
    raise exception 'barbershop not found' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Reactivar (spec feature 22), as in add_subscription_payment_flow, and never
-- on a deleted barbershop.
create or replace function public.reactivate_barbershop(p_barbershop_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  shop public.barbershops;
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  select * into shop
  from public.barbershops
  where id = p_barbershop_id and deleted_at is null
  for update;
  if not found or shop.subscription_status <> 'suspended' then
    raise exception 'barbershop not suspended' using errcode = 'no_data_found';
  end if;

  if private.barbershop_phase(
    case when shop.plan is null then 'trial' else 'active' end::public.subscription_status,
    shop.plan,
    shop.trial_ends_on,
    shop.expires_on,
    (shop.created_at at time zone 'America/Bogota')::date
  ) <> 'active' then
    raise exception 'a payment is required to reactivate'
      using errcode = 'check_violation', hint = 'subscription_payment_required';
  end if;

  update public.barbershops
  set subscription_status = case when plan is null then 'trial' else 'active' end::public.subscription_status
  where id = p_barbershop_id;
end;
$$;

-- Spec feature 22 ("extender prueba"): only during the trial, only forward,
-- and 30 days at most past its end, or past today if it already ended
-- (decision P3).
create or replace function public.extend_trial(p_barbershop_id uuid, p_until date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  shop public.barbershops;
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  select * into shop
  from public.barbershops
  where id = p_barbershop_id and deleted_at is null
  for update;
  if not found or shop.subscription_status <> 'trial' or p_until <= shop.trial_ends_on then
    raise exception 'trial cannot be extended' using errcode = 'no_data_found';
  end if;
  if p_until > greatest(shop.trial_ends_on, private.today_bogota()) + 30 then
    raise exception 'trial extension too long'
      using errcode = 'invalid_parameter_value', hint = 'trial_extension_too_long';
  end if;

  update public.barbershops
  set trial_ends_on = p_until,
      expires_on = greatest(expires_on, p_until)
  where id = p_barbershop_id;
  perform private.recompute_subscription(p_barbershop_id);
end;
$$;

-- 4 (B4): the owner reads their payments without the platform's trace ---------------

revoke select on public.subscription_payments from authenticated;
grant select (
  id, barbershop_id, plan, amount_cop, method, reference,
  paid_on, covers_from, covers_until, created_at, voided_at
) on public.subscription_payments to authenticated;

-- P-02 (task 5.4): the payments of one barbershop with why each void was
-- made, for the super admin only. Newest first, as the record lists them.
create function public.platform_payments(p_barbershop_id uuid)
returns table (
  id uuid,
  amount_cop integer,
  method public.payment_method,
  reference text,
  paid_on date,
  covers_from date,
  covers_until date,
  created_at timestamptz,
  voided_at timestamptz,
  void_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  return query
  select s.id, s.amount_cop, s.method, s.reference, s.paid_on,
         s.covers_from, s.covers_until, s.created_at, s.voided_at, s.void_reason
  from public.subscription_payments s
  where s.barbershop_id = p_barbershop_id
  order by s.paid_on desc, s.created_at desc, s.id;
end;
$$;

revoke all on function public.platform_payments(uuid) from public;
grant execute on function public.platform_payments(uuid) to authenticated;

-- 5 (B5): the guard of the ledger --------------------------------------------------

revoke update, delete, truncate on public.subscription_payments from anon, authenticated, service_role;

-- Payments are never deleted. The only updates allowed: voiding once (the
-- three void columns, nothing else) by the super admin as themselves, or the
-- recompute adjusting covers_*.
create or replace function private.guard_subscription_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'subscription payments are never deleted'
      using errcode = 'insufficient_privilege';
  end if;

  if old.voided_at is null and new.voided_at is not null
    and private.is_super_admin()
    and new.voided_by = auth.uid()
    and (to_jsonb(new) - 'voided_at' - 'voided_by' - 'void_reason')
      = (to_jsonb(old) - 'voided_at' - 'voided_by' - 'void_reason') then
    return new;
  end if;

  if current_setting('yapoin.recomputing_subscription', true) = 'on'
    and (to_jsonb(new) - 'covers_from' - 'covers_until')
      = (to_jsonb(old) - 'covers_from' - 'covers_until') then
    return new;
  end if;

  raise exception 'subscription payments cannot be edited'
    using errcode = 'insufficient_privilege';
end;
$$;
