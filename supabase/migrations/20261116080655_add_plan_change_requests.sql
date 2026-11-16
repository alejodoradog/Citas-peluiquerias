-- Task 7.8b (docs/tareas/7.8-planes.md): "Cambiar plan". Decided by the
-- founder (2026-11-15): the owner asks for the change from their
-- establishment's settings and pays the difference; Yapoin accepts it only by
-- registering that payment, and only then the new plan applies. Moving down
-- a plan goes by WhatsApp (provisional decision 6 of the task).
--
-- The requests and the payment of the difference live in their own table,
-- not in subscription_payments: that ledger replays every payment as a month
-- of service, and a difference is no month. The same rules hold here: a
-- payment is never edited or deleted, voiding it leaves a trace and takes the
-- establishment back to its plan, and it counts as income.

-- 1. The table ------------------------------------------------------------------------------------

create type public.plan_change_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

create table public.plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  from_plan text not null references public.plans (code),
  to_plan text not null references public.plans (code),
  -- What the owner was told to pay when asking.
  amount_cop integer not null check (amount_cop > 0),
  status public.plan_change_status not null default 'pending',
  requested_by uuid not null references public.profiles (id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete restrict,
  decided_at timestamptz,
  -- Why it was rejected.
  reject_reason text check (reject_reason is null or char_length(btrim(reject_reason)) between 1 and 300),
  -- The payment of the difference, once accepted.
  method public.payment_method,
  reference text check (reference is null or char_length(btrim(reference)) between 1 and 100),
  paid_on date,
  -- Voiding the accepted payment: back to from_plan.
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete restrict,
  void_reason text check (void_reason is null or char_length(btrim(void_reason)) between 1 and 300),
  constraint plan_change_requests_plans_differ check (from_plan <> to_plan),
  constraint plan_change_requests_accepted_has_payment check (
    (status = 'accepted') = (method is not null and reference is not null and paid_on is not null)
  ),
  constraint plan_change_requests_decided check (
    (status = 'pending') = (decided_at is null)
  ),
  constraint plan_change_requests_void_only_accepted check (
    voided_at is null or status = 'accepted'
  )
);

-- One pending request per establishment.
create unique index plan_change_requests_one_pending
  on public.plan_change_requests (barbershop_id)
  where status = 'pending';

-- A receipt is registered once, as in subscription_payments.
create unique index plan_change_requests_reference_once
  on public.plan_change_requests (barbershop_id, method, lower(btrim(reference)))
  where status = 'accepted' and voided_at is null;

create index plan_change_requests_status_idx
  on public.plan_change_requests (status, requested_at);

create index plan_change_requests_requested_by_idx on public.plan_change_requests (requested_by);
create index plan_change_requests_decided_by_idx on public.plan_change_requests (decided_by);
create index plan_change_requests_voided_by_idx on public.plan_change_requests (voided_by);

alter table public.plan_change_requests enable row level security;

-- Owners read their establishments' requests; the super admin reads all.
-- Nobody writes the table directly: only the functions below.
grant select on public.plan_change_requests to authenticated;

create policy member_read on public.plan_change_requests
  for select to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));

create policy super_admin_read on public.plan_change_requests
  for select to authenticated
  using ((select private.is_super_admin()));

revoke insert, update, delete, truncate, references, trigger
  on public.plan_change_requests from anon, authenticated, service_role;

-- 2. The guard -----------------------------------------------------------------------------------
-- A request is decided once (pending → accepted, rejected or cancelled) and an
-- accepted one is voided once; nothing else ever changes, and no row is
-- deleted. The functions below are the only writers.

create function private.guard_plan_change_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'plan change requests are never deleted' using errcode = 'insufficient_privilege';
  end if;
  if (new.id, new.barbershop_id, new.from_plan, new.to_plan, new.requested_by, new.requested_at)
     is distinct from
     (old.id, old.barbershop_id, old.from_plan, old.to_plan, old.requested_by, old.requested_at) then
    raise exception 'a plan change request does not change' using errcode = 'insufficient_privilege';
  end if;
  -- The value is settled when the request is accepted (what it costs at that
  -- moment, security review of task 7.8b, M2); after that, never again.
  if new.amount_cop is distinct from old.amount_cop
     and not (old.status = 'pending' and new.status = 'accepted') then
    raise exception 'the value of a request does not change' using errcode = 'insufficient_privilege';
  end if;
  if old.status <> 'pending' and (
    (new.status, new.decided_by, new.decided_at, new.reject_reason, new.method, new.reference, new.paid_on)
    is distinct from
    (old.status, old.decided_by, old.decided_at, old.reject_reason, old.method, old.reference, old.paid_on)
  ) then
    raise exception 'a decided request does not change' using errcode = 'insufficient_privilege';
  end if;
  if old.voided_at is not null and (new.voided_at, new.voided_by, new.void_reason)
     is distinct from (old.voided_at, old.voided_by, old.void_reason) then
    raise exception 'a voided payment does not change' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_plan_change_request() from public;

create trigger guard_plan_change_request
  before update or delete on public.plan_change_requests
  for each row execute function private.guard_plan_change_request();

-- 3. What the change costs -------------------------------------------------------------------------
-- Provisional decisions 2 and 3 (D3 g and h): the fixed difference between the
-- monthly prices ($15.000) once the establishment has a payment that stands;
-- the first payment of the new plan ($25.000) while it is still in its trial
-- or never paid. The expiry never moves: this is no month.

create function private.plan_change_cop(p_barbershop_id uuid, p_from public.plans, p_to public.plans)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.subscription_payments s
      where s.barbershop_id = p_barbershop_id and s.voided_at is null
    )
      then p_to.monthly_price_cop - p_from.monthly_price_cop
    else coalesce(p_to.first_payment_cop, p_to.monthly_price_cop)
  end
$$;

revoke all on function private.plan_change_cop(uuid, public.plans, public.plans) from public;

-- Once a change to a plan stands, its first-month price is spent: the next
-- monthly payment is the full one. Same function as in add_plan_choice.
create or replace function private.next_payment_cop(p_barbershop_id uuid, p_plan public.plans)
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
      and not exists (
        select 1 from public.plan_change_requests r
        where r.barbershop_id = p_barbershop_id
          and r.to_plan = p_plan.code
          and r.status = 'accepted'
          and r.voided_at is null
      )
      then p_plan.first_payment_cop
    else p_plan.monthly_price_cop
  end
$$;

-- 4. The owner asks, or cancels --------------------------------------------------------------------
-- Only up, from plan 1 to plan 2 (provisional decision 6), from an
-- establishment of theirs. Asking changes nothing in the establishment, so a
-- paused one may ask too (provisional decision 5).

create function public.request_plan_change(p_barbershop_id uuid, p_to_plan text)
returns public.plan_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  shop public.barbershops;
  from_row public.plans;
  to_row public.plans;
  request public.plan_change_requests;
begin
  if auth.uid() is null
    or not (p_barbershop_id = any ((select private.member_barbershop_ids())::uuid[])) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  select * into shop
  from public.barbershops
  where id = p_barbershop_id and deleted_at is null
  for update;
  if not found then
    raise exception 'barbershop not found' using errcode = 'no_data_found';
  end if;

  select * into from_row from public.plans where code = shop.selected_plan;
  select * into to_row from public.plans where code = p_to_plan and active;
  if not found or from_row.code <> 'standard' or to_row.code <> 'plus' then
    raise exception 'only plan 1 can move up to plan 2 here'
      using errcode = 'invalid_parameter_value', hint = 'plan_change_not_offered';
  end if;

  begin
    insert into public.plan_change_requests (barbershop_id, from_plan, to_plan, amount_cop, requested_by)
    values (
      p_barbershop_id, from_row.code, to_row.code,
      private.plan_change_cop(p_barbershop_id, from_row, to_row),
      auth.uid()
    )
    returning * into request;
  exception when unique_violation then
    raise exception 'a request is already pending'
      using errcode = 'unique_violation', hint = 'plan_change_pending';
  end;
  return request;
end;
$$;

revoke all on function public.request_plan_change(uuid, text) from public;
grant execute on function public.request_plan_change(uuid, text) to authenticated;

create function public.cancel_plan_change(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.plan_change_requests r
  set status = 'cancelled', decided_by = auth.uid(), decided_at = now()
  where r.id = p_request_id
    and r.status = 'pending'
    and auth.uid() is not null
    and r.barbershop_id = any ((select private.member_barbershop_ids())::uuid[]);
  if not found then
    raise exception 'request not found or already decided' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.cancel_plan_change(uuid) from public;
grant execute on function public.cancel_plan_change(uuid) to authenticated;

-- 5. Yapoin decides --------------------------------------------------------------------------------
-- The requests with their establishment, for the super admin: the pending
-- ones for "Solicitudes", or every one of an establishment for its ficha.

create function public.platform_plan_changes(
  p_barbershop_id uuid default null,
  p_pending_only boolean default false
)
returns table (
  id uuid,
  barbershop_id uuid,
  barbershop_name text,
  owner_name text,
  from_plan text,
  to_plan text,
  amount_cop integer,
  status public.plan_change_status,
  requested_at timestamptz,
  decided_at timestamptz,
  reject_reason text,
  method public.payment_method,
  reference text,
  paid_on date,
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

  -- A pending request shows what it costs now (M2): a monthly payment
  -- registered or voided since it was asked changes it.
  return query
  select r.id, r.barbershop_id, b.name, p.full_name, r.from_plan, r.to_plan,
         case when r.status = 'pending'
           then private.plan_change_cop(r.barbershop_id, fp, tp)
           else r.amount_cop
         end,
         r.status, r.requested_at, r.decided_at, r.reject_reason, r.method, r.reference,
         r.paid_on, r.voided_at, r.void_reason
  from public.plan_change_requests r
  join public.barbershops b on b.id = r.barbershop_id
  join public.plans fp on fp.code = r.from_plan
  join public.plans tp on tp.code = r.to_plan
  left join public.profiles p on p.id = r.requested_by
  where b.deleted_at is null
    and (p_barbershop_id is null or r.barbershop_id = p_barbershop_id)
    and (not p_pending_only or r.status = 'pending')
  order by r.requested_at desc, r.id;
end;
$$;

revoke all on function public.platform_plan_changes(uuid, boolean) from public;
grant execute on function public.platform_plan_changes(uuid, boolean) to authenticated;

-- Accepting is registering the payment of the difference: there is no other
-- way. p_amount_cop is the value the screen showed; the plan must still be
-- the one the owner asked to leave (plan_changed), and the receipt must not
-- be registered already, here or as a monthly payment.

create function public.accept_plan_change(
  p_request_id uuid,
  p_method public.payment_method,
  p_reference text,
  p_paid_on date,
  p_amount_cop integer
)
returns public.plan_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.plan_change_requests;
  shop public.barbershops;
  from_row public.plans;
  to_row public.plans;
  amount integer;
  today date := private.today_bogota();
  -- Trimmed like register_subscription_payment's (5.4b, M1).
  clean_reference text := regexp_replace(
    p_reference, '^[[:space:]' || chr(160) || ']+|[[:space:]' || chr(160) || ']+$', '', 'g');
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  select * into request from public.plan_change_requests where id = p_request_id;
  if not found then
    raise exception 'request not found' using errcode = 'no_data_found';
  end if;

  -- The establishment first, the same lock order as the payments.
  select * into shop
  from public.barbershops
  where id = request.barbershop_id and deleted_at is null
  for update;
  if not found then
    raise exception 'barbershop not found' using errcode = 'no_data_found';
  end if;

  select * into request from public.plan_change_requests where id = p_request_id for update;
  if request.status <> 'pending' then
    raise exception 'request already decided' using errcode = 'no_data_found';
  end if;
  if shop.selected_plan <> request.from_plan then
    raise exception 'the establishment changed its plan'
      using errcode = 'invalid_parameter_value', hint = 'plan_changed';
  end if;
  -- What it costs now, with the establishment locked (M2): the value kept
  -- when it was asked may be old.
  select * into from_row from public.plans where code = request.from_plan;
  select * into to_row from public.plans where code = request.to_plan;
  amount := private.plan_change_cop(request.barbershop_id, from_row, to_row);
  if p_amount_cop is distinct from amount then
    raise exception 'the price changed since it was shown'
      using errcode = 'invalid_parameter_value', hint = 'price_changed';
  end if;
  if p_paid_on is null or p_paid_on > today
    or p_paid_on < greatest(today - 31, (request.requested_at at time zone 'America/Bogota')::date) then
    raise exception 'payment day out of range'
      using errcode = 'invalid_parameter_value', hint = 'payment_day_out_of_range';
  end if;
  if exists (
    select 1 from public.subscription_payments s
    where s.barbershop_id = request.barbershop_id
      and s.method = p_method
      and lower(btrim(s.reference)) = lower(clean_reference)
      and s.voided_at is null
  ) then
    raise exception 'payment already registered'
      using errcode = 'unique_violation', hint = 'payment_already_registered';
  end if;

  begin
    update public.plan_change_requests
    set status = 'accepted', decided_by = auth.uid(), decided_at = now(),
        amount_cop = amount,
        method = p_method, reference = clean_reference, paid_on = p_paid_on
    where id = p_request_id
    returning * into request;
  exception when unique_violation then
    raise exception 'payment already registered'
      using errcode = 'unique_violation', hint = 'payment_already_registered';
  end;

  update public.barbershops set selected_plan = request.to_plan where id = request.barbershop_id;
  return request;
end;
$$;

revoke all on function public.accept_plan_change(uuid, public.payment_method, text, date, integer) from public;
grant execute on function public.accept_plan_change(uuid, public.payment_method, text, date, integer) to authenticated;

create function public.reject_plan_change(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  -- Always with its reason, for the record (B2).
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'a reason is required' using errcode = 'invalid_parameter_value';
  end if;
  update public.plan_change_requests
  set status = 'rejected', decided_by = auth.uid(), decided_at = now(), reject_reason = btrim(p_reason)
  where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'request not found or already decided' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.reject_plan_change(uuid, text) from public;
grant execute on function public.reject_plan_change(uuid, text) to authenticated;

-- Voiding the payment of the difference takes the establishment back to the
-- plan it left, when it is still on the plan it got. Its professionals stay;
-- over the limit it cannot add or reactivate any until it fits again.

create function public.void_plan_change(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.plan_change_requests;
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  -- Always with its reason, for the record (B2).
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'a reason is required' using errcode = 'invalid_parameter_value';
  end if;

  select * into request from public.plan_change_requests where id = p_request_id;
  if not found then
    raise exception 'request not found' using errcode = 'no_data_found';
  end if;
  perform 1 from public.barbershops where id = request.barbershop_id for update;

  update public.plan_change_requests
  set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = p_request_id and status = 'accepted' and voided_at is null
  returning * into request;
  if not found then
    raise exception 'payment not found or already voided' using errcode = 'no_data_found';
  end if;

  update public.barbershops
  set selected_plan = request.from_plan
  where id = request.barbershop_id and selected_plan = request.to_plan;
end;
$$;

revoke all on function public.void_plan_change(uuid, text) from public;
grant execute on function public.void_plan_change(uuid, text) to authenticated;

-- 5b. A receipt counts once across both ledgers (security review, M1) -------------------------
-- Same function as in add_plan_choice, and a monthly payment is refused when
-- its method and reference are those of an accepted plan change that stands
-- (accept_plan_change already refuses the other way round). Both lock the
-- establishment first, so they cannot pass each other.

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

  if exists (
    select 1 from public.plan_change_requests r
    where r.barbershop_id = p_barbershop_id
      and r.status = 'accepted'
      and r.voided_at is null
      and r.method = p_method
      and lower(btrim(r.reference)) = lower(clean_reference)
  ) then
    raise exception 'payment already registered'
      using errcode = 'unique_violation', hint = 'payment_already_registered';
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

-- 5c. A new sede takes the plan chosen at sign-up (security review, B1) ------------------------
-- Same function as in add_plan_choice, but a first sede that moved up by a
-- plan change passes plan 1 on: its new sedes did not pay any difference.

create or replace function private.inherit_selected_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.barbershops b
  set selected_plan = first.inherited
  from (
    select case
      when exists (
        select 1 from public.plan_change_requests r
        where r.barbershop_id = o.id
          and r.status = 'accepted'
          and r.voided_at is null
          and r.to_plan = o.selected_plan
      ) then 'standard'
      else o.selected_plan
    end as inherited
    from public.memberships m
    join public.barbershops o on o.id = m.barbershop_id
    where m.user_id = new.user_id
      and m.role = 'owner'
      and o.id <> new.barbershop_id
    order by o.created_at, o.id
    limit 1
  ) first
  where b.id = new.barbershop_id
    and b.selected_plan is distinct from first.inherited;
  return null;
end;
$$;

-- 6. Income by month counts the differences ---------------------------------------------------------
-- Same function as in add_platform_metrics, adding the accepted payments of
-- a plan change that stand.

create or replace function public.platform_monthly_revenue(p_months integer default 12)
returns table (
  month_start date,
  total_cop bigint,
  payments integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  first_month date;
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'months out of range' using errcode = 'invalid_parameter_value';
  end if;

  first_month := (date_trunc('month', private.today_bogota()) - make_interval(months => p_months - 1))::date;

  return query
  with months as (
    select (first_month + make_interval(months => g))::date as month_start
    from generate_series(0, p_months - 1) as g
  ),
  received as (
    select s.paid_on, s.amount_cop
    from public.subscription_payments s
    where s.voided_at is null and s.paid_on >= first_month
    union all
    select r.paid_on, r.amount_cop
    from public.plan_change_requests r
    where r.status = 'accepted' and r.voided_at is null and r.paid_on >= first_month
  ),
  paid as (
    select date_trunc('month', x.paid_on)::date as month_start,
           sum(x.amount_cop) as total,
           count(*) as n
    from received x
    group by 1
  )
  select m.month_start,
         coalesce(p.total, 0)::bigint,
         coalesce(p.n, 0)::integer
  from months m
  left join paid p on p.month_start = m.month_start
  order by m.month_start;
end;
$$;
