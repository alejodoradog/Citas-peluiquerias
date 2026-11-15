-- Task 5.6 (docs/tareas/5.6-precio-por-barberos.md): the price depends on
-- how many barbers a barbershop has (founder's decision of 2026-11-14):
--   1 to 4 active barbers   $25.000 a month   (plan standard)
--   5 to 8                  $40.000 a month   (plan plus)
--   9 or more               agreed with Yapoin's finance area (plan por_acuerdo)
-- The owner who also cuts is a barber row (is_owner) and counts. Adding a
-- barber is never blocked (spec): the tier is measured when each payment is
-- registered, with the active barbers of that day, so a barbershop that
-- grows pays the new price from its next payment (provisional decisions P1
-- and P2 of the task).

-- 1. The catalog ---------------------------------------------------------------------------------

alter table public.plans
  add column min_barbers integer not null default 1 check (min_barbers > 0),
  add column max_barbers integer check (max_barbers is null or max_barbers > 0),
  add column by_agreement boolean not null default false,
  alter column monthly_price_cop drop not null,
  add constraint plans_barbers_order check (max_barbers is null or max_barbers >= min_barbers),
  -- A plan has a fixed price, or its price is agreed for each barbershop.
  add constraint plans_price_or_agreement check ((monthly_price_cop is null) = by_agreement);

update public.plans
set name = 'Hasta 4 barberos', min_barbers = 1, max_barbers = 4, included_barbers = 4,
    monthly_price_cop = 25000, sort_order = 1
where code = 'standard';

insert into public.plans (code, name, monthly_price_cop, included_barbers, min_barbers, max_barbers, by_agreement, sort_order)
values
  ('plus', 'De 5 a 8 barberos', 40000, 8, 5, 8, false, 2),
  ('por_acuerdo', '9 barberos o más', null, 9, 9, null, true, 3)
on conflict (code) do nothing;

-- 2. The plan of a barbershop ----------------------------------------------------------------------

create function private.active_barbers(p_barbershop_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.barbers b
  where b.barbershop_id = p_barbershop_id and b.active
$$;

revoke all on function private.active_barbers(uuid) from public;

-- The plan on sale for that many barbers (a barbershop with none yet is
-- priced as one).
create function private.plan_for_barbers(p_barbers integer)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.plans p
  where p.active
    and greatest(p_barbers, 1) >= p.min_barbers
    and (p.max_barbers is null or greatest(p_barbers, 1) <= p.max_barbers)
  order by p.sort_order, p.code
  limit 1
$$;

revoke all on function private.plan_for_barbers(integer) from public;

-- What a barbershop pays today: its tier, the price (null when it is agreed)
-- and its active barbers. For its owners (the agenda's notice, D-70 to
-- D-72), the super admin (P-02, P-03) and the server key (the emails).
create function public.subscription_quote(p_barbershop_id uuid)
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
  barbers integer;
  chosen public.plans;
begin
  if not (
    private.is_super_admin()
    or p_barbershop_id = any ((select private.member_barbershop_ids())::uuid[])
    or coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
  ) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.barbershops b where b.id = p_barbershop_id and b.deleted_at is null) then
    return;
  end if;
  barbers := private.active_barbers(p_barbershop_id);
  chosen := private.plan_for_barbers(barbers);
  if chosen.code is null then
    return;
  end if;
  return query select chosen.code, chosen.name, chosen.monthly_price_cop, chosen.by_agreement, barbers;
end;
$$;

revoke all on function public.subscription_quote(uuid) from public;
grant execute on function public.subscription_quote(uuid) to authenticated, service_role;

-- 3. Registering a payment --------------------------------------------------------------------------
-- As in harden_subscription_payments (task 5.4b), and now the database picks
-- the plan from the barbers. p_plan is the plan the screen showed: if the
-- barbers changed in between, the payment is refused (plan_changed) so the
-- super admin sees the new price. For an agreed plan, p_amount_cop is the
-- agreed price, between $1.000 and $5.000.000.

drop function public.register_subscription_payment(uuid, text, public.payment_method, text, date);

create function public.register_subscription_payment(
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
  chosen := private.plan_for_barbers(private.active_barbers(p_barbershop_id));
  if chosen.code is distinct from p_plan then
    raise exception 'the barbers changed: another plan applies'
      using errcode = 'invalid_parameter_value', hint = 'plan_changed';
  end if;

  if chosen.by_agreement then
    if p_amount_cop is null or p_amount_cop not between 1000 and 5000000 then
      raise exception 'an agreed plan needs its amount'
        using errcode = 'invalid_parameter_value', hint = 'agreed_amount_required';
    end if;
    amount := p_amount_cop;
  else
    amount := chosen.monthly_price_cop;
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
      amount,
      p_method,
      clean_reference,
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

revoke all on function public.register_subscription_payment(uuid, text, public.payment_method, text, date, integer) from public;
grant execute on function public.register_subscription_payment(uuid, text, public.payment_method, text, date, integer) to authenticated;
