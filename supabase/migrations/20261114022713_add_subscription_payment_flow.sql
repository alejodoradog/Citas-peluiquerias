-- Task 5.4: the subscription has one write path and one formula.
-- - subscription_payments is the ledger: the super admin registers each bank
--   transfer by hand. Rows are never edited or deleted; a wrong row is voided
--   with a trace (who, when, why). Each payment covers one month.
-- - barbershops.expires_on, plan and subscription_status are derived by
--   private.recompute_subscription(): it replays the non-voided payments over
--   trial_ends_on with the spec date rule. The validity comes only from
--   payments; nothing else extends it except extend_trial during the trial.
-- - The phase (active, awaiting first payment, expired, suspended) is derived
--   by private.barbershop_phase(); no job changes states (decision 0001, 7).
-- See docs/decisiones/0006-esquema-base-de-datos-final.md.

-- The phase (active, awaiting first payment, expired, suspended) is
-- private.barbershop_phase, created word for word by task 3.3
-- (20261111050000_add_public_booking.sql); this migration does not create it
-- again. Its copy in TypeScript is src/modulos/suscripciones/dominio.

-- Voiding: all three columns together, once.
alter table public.subscription_payments
  add column voided_at timestamptz,
  add column voided_by uuid references public.profiles (id) on delete restrict,
  add column void_reason text check (char_length(btrim(void_reason)) between 1 and 200),
  add constraint subscription_payments_void_together check (
    (voided_at is null) = (voided_by is null)
    and (voided_at is null) = (void_reason is null)
  );

create index subscription_payments_voided_by_idx
  on public.subscription_payments (voided_by)
  where voided_by is not null;

-- Spec, "Regla de fechas", applied to every non-voided payment in order, one
-- month each: paid on or before the current expiry, the month is added to it;
-- paid later, it counts from the payment day. Jan 31 + 1 month = Feb 28.
-- A new payment also lifts a manual suspension (spec: "al registrar un pago,
-- todo vuelve a funcionar al instante"); a void or a trial extension does not.
create function private.recompute_subscription(
  p_barbershop_id uuid,
  p_lift_suspension boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expiry date;
  last_plan text;
  payment record;
  new_from date;
  new_until date;
begin
  select b.trial_ends_on into expiry
  from public.barbershops b
  where b.id = p_barbershop_id
  for update;
  if not found then
    raise exception 'barbershop not found' using errcode = 'no_data_found';
  end if;

  perform set_config('yapoin.recomputing_subscription', 'on', true);

  for payment in
    select s.id, s.plan, s.paid_on, s.covers_from, s.covers_until
    from public.subscription_payments s
    where s.barbershop_id = p_barbershop_id
      and s.voided_at is null
    order by s.paid_on, s.created_at, s.id
  loop
    if payment.paid_on <= expiry then
      new_from := expiry + 1;
      new_until := (expiry + interval '1 month')::date;
    else
      new_from := payment.paid_on;
      new_until := (payment.paid_on + interval '1 month')::date - 1;
    end if;

    if (new_from, new_until) is distinct from (payment.covers_from, payment.covers_until) then
      update public.subscription_payments
      set covers_from = new_from, covers_until = new_until
      where id = payment.id;
    end if;

    expiry := new_until;
    last_plan := payment.plan;
  end loop;

  perform set_config('yapoin.recomputing_subscription', 'off', true);

  update public.barbershops
  set expires_on = expiry,
      plan = last_plan,
      subscription_status = case
        when subscription_status = 'suspended' and not p_lift_suspension then 'suspended'
        when last_plan is null then 'trial'
        else 'active'
      end::public.subscription_status
  where id = p_barbershop_id;
end;
$$;

revoke all on function private.recompute_subscription(uuid, boolean) from public;

-- covers_* must be not null on insert: provisional values with the same rule
-- over the current expiry; the recompute that follows settles them.
create function private.set_payment_coverage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_expiry date;
begin
  select b.expires_on into current_expiry
  from public.barbershops b
  where b.id = new.barbershop_id
  for update;
  if not found then
    raise exception 'barbershop not found' using errcode = 'foreign_key_violation';
  end if;

  if new.paid_on <= current_expiry then
    new.covers_from := current_expiry + 1;
    new.covers_until := (current_expiry + interval '1 month')::date;
  else
    new.covers_from := new.paid_on;
    new.covers_until := (new.paid_on + interval '1 month')::date - 1;
  end if;
  return new;
end;
$$;

-- Payments are never deleted. The only updates allowed: voiding once (the
-- three void columns, nothing else), or the recompute adjusting covers_*.
create function private.guard_subscription_payment()
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

create function private.recompute_after_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.recompute_subscription(new.barbershop_id, tg_op = 'INSERT');
  return null;
end;
$$;

create trigger set_payment_coverage
  before insert on public.subscription_payments
  for each row execute function private.set_payment_coverage();

create trigger guard_subscription_payment
  before update or delete on public.subscription_payments
  for each row execute function private.guard_subscription_payment();

create trigger recompute_after_payment
  after insert on public.subscription_payments
  for each row execute function private.recompute_after_payment();

create trigger recompute_after_void
  after update of voided_at on public.subscription_payments
  for each row
  when (old.voided_at is null and new.voided_at is not null)
  execute function private.recompute_after_payment();

-- Super admin functions (spec features 21 and 22) ---------------------------------

-- One month of the plan, at the plan's current price. Also lifts a manual
-- suspension.
create function public.register_subscription_payment(
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
  payment_id uuid;
  payment public.subscription_payments;
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  select * into chosen from public.plans where code = p_plan and active;
  if not found then
    raise exception 'unknown plan' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.subscription_payments (
    barbershop_id, plan, amount_cop, method, reference, paid_on, registered_by
  ) values (
    p_barbershop_id,
    chosen.code,
    chosen.monthly_price_cop,
    p_method,
    btrim(p_reference),
    coalesce(p_paid_on, private.today_bogota()),
    auth.uid()
  )
  returning id into payment_id;

  -- Read after the recompute, which may have settled covers_*.
  select * into payment from public.subscription_payments where id = payment_id;
  return payment;
end;
$$;

create function public.void_subscription_payment(p_payment_id uuid, p_reason text)
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
  join public.subscription_payments s on s.barbershop_id = b.id
  where s.id = p_payment_id
  for update of b;

  update public.subscription_payments
  set voided_at = now(),
      voided_by = auth.uid(),
      void_reason = btrim(p_reason)
  where id = p_payment_id
    and voided_at is null;
  if not found then
    raise exception 'payment not found or already voided' using errcode = 'no_data_found';
  end if;

  select * into payment from public.subscription_payments where id = p_payment_id;
  return payment;
end;
$$;

create function public.suspend_barbershop(p_barbershop_id uuid)
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
  where id = p_barbershop_id;
  if not found then
    raise exception 'barbershop not found' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Reactivar (spec feature 22): lifts a manual suspension of a barbershop whose
-- validity, from its payments (or its trial), still covers today or the grace
-- days. It never touches dates. If the validity has run out, it refuses with
-- hint subscription_payment_required: registering the payment is what
-- reactivates it, because a payment already lifts the manual suspension.
create function public.reactivate_barbershop(p_barbershop_id uuid)
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
  where id = p_barbershop_id
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

-- Spec feature 22 ("extender prueba"): only for this barbershop, only during
-- its trial (no payments) and only forward.
create function public.extend_trial(p_barbershop_id uuid, p_until date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.barbershops
  set trial_ends_on = p_until,
      expires_on = greatest(expires_on, p_until)
  where id = p_barbershop_id
    and subscription_status = 'trial'
    and p_until > trial_ends_on;
  if not found then
    raise exception 'trial cannot be extended' using errcode = 'no_data_found';
  end if;
  perform private.recompute_subscription(p_barbershop_id);
end;
$$;

revoke all on function public.register_subscription_payment(uuid, text, public.payment_method, text, date) from public;
revoke all on function public.void_subscription_payment(uuid, text) from public;
revoke all on function public.suspend_barbershop(uuid) from public;
revoke all on function public.reactivate_barbershop(uuid) from public;
revoke all on function public.extend_trial(uuid, date) from public;
grant execute on function public.register_subscription_payment(uuid, text, public.payment_method, text, date) to authenticated;
grant execute on function public.void_subscription_payment(uuid, text) to authenticated;
grant execute on function public.suspend_barbershop(uuid) to authenticated;
grant execute on function public.reactivate_barbershop(uuid) to authenticated;
grant execute on function public.extend_trial(uuid, date) to authenticated;

-- Align barbershops that already have payments with the formula.
select private.recompute_subscription(b.id)
from public.barbershops b
where exists (select 1 from public.subscription_payments s where s.barbershop_id = b.id);

-- Task 5.4, P-01 and P-02: the barbershops of the platform for the super
-- admin, with the owner's name, phone and email. The email lives in
-- auth.users, which no session reads, so this is the only way to it; the
-- function answers the super admin only (an owner gets an error, not an
-- empty list, so a mistake in the app shows up). Deleted barbershops stay
-- out. p_search finds a barbershop by its name or slug, or by its owner's
-- name or email (P-01: "Buscar barbería, dueño o correo").
create function public.platform_barbershops(p_search text default null)
returns table (
  id uuid,
  name text,
  slug text,
  locality text,
  subscription_status public.subscription_status,
  plan text,
  trial_ends_on date,
  expires_on date,
  created_at timestamptz,
  phase text,
  owner_name text,
  owner_phone text,
  owner_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text;
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_search is not null and char_length(p_search) > 100 then
    raise exception 'search too long' using errcode = 'invalid_parameter_value';
  end if;
  -- The words typed, literally: % and _ are not wildcards here.
  pattern := '%' || replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    b.id,
    b.name,
    b.slug,
    b.locality,
    b.subscription_status,
    b.plan,
    b.trial_ends_on,
    b.expires_on,
    b.created_at,
    private.barbershop_phase(
      b.subscription_status, b.plan, b.trial_ends_on, b.expires_on,
      (b.created_at at time zone 'America/Bogota')::date
    ),
    p.full_name,
    p.phone,
    u.email::text
  from public.barbershops b
  left join public.memberships m
    on m.barbershop_id = b.id and m.role = 'owner'
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where b.deleted_at is null
    and (
      btrim(coalesce(p_search, '')) = ''
      or b.name ilike pattern
      or b.slug ilike pattern
      or p.full_name ilike pattern
      or u.email ilike pattern
    )
  order by b.name, b.id;
end;
$$;

revoke all on function public.platform_barbershops(text) from public;
grant execute on function public.platform_barbershops(text) to authenticated;
