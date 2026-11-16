-- Task 7.8a (docs/tareas/7.8-planes.md): the 30-day trial and the plan each
-- establishment chooses. Decided by the founder (2026-11-15):
--
-- - The free trial lasts 30 days, and only plan 1 (standard) has it.
-- - Plan 1 allows up to 4 active professionals, counting the owner when they
--   also attend (they have their own row in barbers); plan 2 (plus), up to 8.
--   The database refuses one more, whatever screen or request asks for it.
-- - Plan 2 has no trial: everything can be set up, but customers cannot book
--   until Yapoin registers its first payment, $25.000. That is the state a
--   barbershop created after its trial already has (awaiting_first_payment,
--   private.barbershop_phase): its trial ended the day before it was created.
-- - The price is the chosen plan's, no longer the one the active barbers fall
--   in (task 5.6); "por acuerdo" keeps its agreed amount.
--
-- barbershops.plan stays what it was: the plan of the last payment (null
-- before the first one). selected_plan is the plan chosen, the one that
-- limits the professionals and sets the price.

-- 1. The plans: the first payment of plan 2 --------------------------------------------
-- Plan 2 shows $40.000 crossed out and $25.000 the first month. Null means the
-- first payment is the monthly price.

alter table public.plans
  add column first_payment_cop integer,
  add constraint plans_first_payment_positive check (first_payment_cop is null or first_payment_cop > 0);

update public.plans set first_payment_cop = 25000 where code = 'plus';

-- 2. The chosen plan -------------------------------------------------------------------------------
-- No session changes it (the column grants of barbershops are lists): it is
-- set at sign-up by the trigger below, and later only by a plan change that
-- Yapoin accepts (task 7.8b). Owners read it with the rest of their row.

alter table public.barbershops
  add column selected_plan text not null default 'standard' references public.plans (code);

-- The barbershops that exist keep the plan their active barbers fall in today,
-- so none of them is left over its limit.
update public.barbershops b
set selected_plan = (private.plan_for_barbers(private.active_barbers(b.id))).code
where (private.plan_for_barbers(private.active_barbers(b.id))).code is not null;

-- 3. The trial lasts 30 days ------------------------------------------------------------------
-- The literal stays in this form because trial.test.ts compares it with
-- TRIAL_DAYS. Barbershops that already exist keep their dates.

create or replace function private.new_trial_expires_on()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date + 30
$$;

-- 4. The plan chosen at sign-up --------------------------------------------------------------------
-- After on_auth_user_created (triggers run in name order), which made the
-- barbershop and the membership, as record_business_type does. The metadata
-- comes from the browser: only "plus" changes anything; anything else is
-- plan 1, the default. Plan 2 starts without a trial: it ended the day
-- before, so the barbershop waits for its first payment.

create function private.record_selected_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'plan' is distinct from 'plus' then
    return null;
  end if;

  update public.barbershops b
  set selected_plan = 'plus',
      trial_ends_on = (b.created_at at time zone 'America/Bogota')::date - 1,
      expires_on = (b.created_at at time zone 'America/Bogota')::date - 1
  from public.memberships m
  where m.user_id = new.id
    and m.role = 'owner'
    and b.id = m.barbershop_id;
  return null;
end;
$$;

revoke all on function private.record_selected_plan() from public;

create trigger record_selected_plan
  after insert on auth.users
  for each row execute function private.record_selected_plan();

-- A barbershop the owner opens later (create_barbershop) takes the plan of
-- their first one, as it takes its kind (inherit_business_type). Its trial is
-- already the account's (it may be over).

create function private.inherit_selected_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.barbershops b
  set selected_plan = first.selected_plan
  from (
    select o.selected_plan
    from public.memberships m
    join public.barbershops o on o.id = m.barbershop_id
    where m.user_id = new.user_id
      and m.role = 'owner'
      and o.id <> new.barbershop_id
    order by o.created_at, o.id
    limit 1
  ) first
  where b.id = new.barbershop_id
    and b.selected_plan is distinct from first.selected_plan;
  return null;
end;
$$;

revoke all on function private.inherit_selected_plan() from public;

create trigger inherit_selected_plan
  after insert on public.memberships
  for each row
  when (new.role = 'owner')
  execute function private.inherit_selected_plan();

-- 5. The limit of professionals --------------------------------------------------------------------
-- On every way a professional becomes active: a new row (Más › Profesionales,
-- the setup wizard, a request made by hand) or reactivating one. The row of
-- the barbershop is locked first, so two at the same time cannot both slip
-- under the limit. "Por acuerdo" has no limit.

create function private.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  most integer;
  others integer;
begin
  if not new.active or (tg_op = 'UPDATE' and old.active) then
    return new;
  end if;

  select p.max_barbers into most
  from public.barbershops b
  join public.plans p on p.code = b.selected_plan
  where b.id = new.barbershop_id
  for no key update of b;

  if most is null then
    return new;
  end if;

  select count(*) into others
  from public.barbers br
  where br.barbershop_id = new.barbershop_id
    and br.active
    and br.id <> new.id;

  -- Read committed (what PostgREST uses): after waiting for the lock, the
  -- count sees the rows the other transaction committed. Under repeatable
  -- read or serializable it would not.
  if others + 1 > most then
    raise exception 'the plan allows % active professionals', most
      using errcode = 'check_violation', hint = 'plan_limit';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_plan_limit() from public;

create trigger enforce_plan_limit
  before insert or update of active on public.barbers
  for each row execute function private.enforce_plan_limit();

-- 6. What a barbershop pays: its chosen plan ---------------------------------------------------
-- Same function as in add_price_by_barbers, with the plan read from the
-- barbershop. The price is the plan's first payment until one payment
-- stands (plan 2: $25.000), then its monthly price. active_barbers stays in
-- the answer: P-03 and the payments keep showing it.

create or replace function public.subscription_quote(p_barbershop_id uuid)
returns table (
  plan_code text,
  plan_name text,
  price_cop integer,
  by_agreement boolean,
  active_barbers integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  chosen public.plans;
begin
  if not (
    private.is_super_admin()
    or p_barbershop_id = any ((select private.member_barbershop_ids())::uuid[])
    or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
  ) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  select p.* into chosen
  from public.barbershops b
  join public.plans p on p.code = b.selected_plan
  where b.id = p_barbershop_id and b.deleted_at is null;
  if not found then
    return;
  end if;

  return query select
    chosen.code,
    chosen.name,
    private.next_payment_cop(p_barbershop_id, chosen),
    chosen.by_agreement,
    private.active_barbers(p_barbershop_id);
end;
$$;

-- The price of the next payment of a plan: its first payment while the
-- barbershop has no payment that stands, its monthly price after. Null for
-- "por acuerdo".
-- Security invoker: only the security definer functions above call it.
create function private.next_payment_cop(p_barbershop_id uuid, p_plan public.plans)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when p_plan.first_payment_cop is not null
      and not exists (
        select 1 from public.subscription_payments s
        where s.barbershop_id = p_barbershop_id and s.voided_at is null
      )
      then p_plan.first_payment_cop
    else p_plan.monthly_price_cop
  end
$$;

revoke all on function private.next_payment_cop(uuid, public.plans) from public;

-- 7. Registering a payment: by the chosen plan ------------------------------------------------
-- Same function as in add_price_by_barbers. p_plan is the plan the screen
-- showed: if the barbershop's plan changed in between (task 7.8b), the
-- payment is refused (plan_changed) so the super admin sees the new price.
-- For a fixed plan, p_amount_cop is the price the screen showed: plan 2's
-- changes without changing plan (its first payment, then the monthly one),
-- so a payment registered or voided meanwhile refuses it too
-- (price_changed, security review of task 7.8a). Null skips the check.

create or replace function public.register_subscription_payment(
  p_barbershop_id uuid,
  p_plan text,
  p_method public.payment_method,
  p_reference text,
  p_paid_on date default null,
  p_amount_cop integer default null
)
returns public.subscription_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen public.plans;
  shop public.barbershops;
  amount integer;
  barbers integer;
  today date := private.today_bogota();
  paid date := coalesce(p_paid_on, private.today_bogota());
  -- Without spaces, tabs, line breaks or non-breaking spaces at either end,
  -- so the same reference typed another way is still the same (5.4b, M1).
  clean_reference text := regexp_replace(
    p_reference, '^[[:space:]' || chr(160) || ']+|[[:space:]' || chr(160) || ']+$', '', 'g');
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

  if not exists (select 1 from public.plans p where p.code = p_plan and p.active) then
    raise exception 'unknown plan' using errcode = 'invalid_parameter_value';
  end if;
  select * into chosen from public.plans p where p.code = shop.selected_plan;
  if chosen.code is distinct from p_plan then
    raise exception 'the barbershop changed its plan'
      using errcode = 'invalid_parameter_value', hint = 'plan_changed';
  end if;
  barbers := private.active_barbers(p_barbershop_id);

  if chosen.by_agreement then
    if p_amount_cop is null or p_amount_cop not between 40000 and 5000000 then
      raise exception 'an agreed plan needs its amount'
        using errcode = 'invalid_parameter_value', hint = 'agreed_amount_required';
    end if;
    amount := p_amount_cop;
  else
    amount := private.next_payment_cop(p_barbershop_id, chosen);
    if p_amount_cop is not null and p_amount_cop is distinct from amount then
      raise exception 'the price changed since it was shown'
        using errcode = 'invalid_parameter_value', hint = 'price_changed';
    end if;
  end if;

  if paid > today
    or paid < greatest(today - 31, (shop.created_at at time zone 'America/Bogota')::date) then
    raise exception 'payment day out of range'
      using errcode = 'invalid_parameter_value', hint = 'payment_day_out_of_range';
  end if;

  begin
    insert into public.subscription_payments (
      barbershop_id, plan, amount_cop, method, reference, paid_on, registered_by, active_barbers
    ) values (
      p_barbershop_id,
      chosen.code,
      amount,
      p_method,
      clean_reference,
      paid,
      auth.uid(),
      barbers
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
