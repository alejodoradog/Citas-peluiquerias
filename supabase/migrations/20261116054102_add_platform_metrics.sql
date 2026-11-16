-- Task 7.12 (docs/tareas/7.12-admin-escritorio.md): the platform panel on a
-- computer, with metrics. Everything here answers the super admin only, like
-- the other platform functions (private.is_super_admin): an owner gets an
-- error, not an empty answer. The totals are counted here, so the browser
-- never receives the appointments or the payments themselves.
--
-- Weeks start on Monday and months on the 1st, in America/Bogota, like
-- every date the panel shows. Weeks and months with nothing still come back,
-- with zeros, so a chart has no gaps.

-- 1. P-01 shows the kind of each establishment (task 7.2) -------------------------
-- Same function as in add_subscription_payment_flow, with two more columns.
-- A new result type needs drop and create.

drop function public.platform_barbershops(text);

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
  owner_email text,
  business_type public.business_type,
  business_type_other text
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
  pattern := '%' || replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';

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
    u.email::text,
    b.business_type,
    b.business_type_other
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

-- 1b. The plans speak of professionals (task 7.1) -----------------------------------
-- Their names show in P-02 and P-03 and in the subscription emails. Yapoin is
-- for every kind of establishment, not only barbershops.

update public.plans
set name = case code
  when 'standard' then 'Hasta 4 profesionales'
  when 'plus' then 'De 5 a 8 profesionales'
  when 'por_acuerdo' then '9 profesionales o más'
end
where code in ('standard', 'plus', 'por_acuerdo');

-- 2. Sign-ups and appointments by week ----------------------------------------------
-- A sign-up is an establishment created that week (the deleted ones stay
-- out, as in P-01). An appointment counts the week it was created, from any
-- source and whatever happened to it later (decision 2 of the task).

-- The weeks are read by when appointments were created, which no index
-- covered (they all start with barbershop_id).
create index appointments_created_at_idx on public.appointments (created_at);

create function public.platform_weekly_activity(p_weeks integer default 12)
returns table (
  week_start date,
  signups integer,
  appointments integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  this_week date;
  first_week date;
  since timestamptz;
begin
  if not private.is_super_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 52 then
    raise exception 'weeks out of range' using errcode = 'invalid_parameter_value';
  end if;

  this_week := date_trunc('week', private.today_bogota())::date;
  first_week := this_week - 7 * (p_weeks - 1);
  since := first_week::timestamp at time zone 'America/Bogota';

  return query
  with weeks as (
    select (first_week + 7 * g)::date as week_start
    from generate_series(0, p_weeks - 1) as g
  ),
  new_shops as (
    select date_trunc('week', b.created_at at time zone 'America/Bogota')::date as week_start,
           count(*) as n
    from public.barbershops b
    where b.deleted_at is null
      and b.created_at >= since
    group by 1
  ),
  booked as (
    select date_trunc('week', a.created_at at time zone 'America/Bogota')::date as week_start,
           count(*) as n
    from public.appointments a
    join public.barbershops b on b.id = a.barbershop_id
    where b.deleted_at is null
      and a.created_at >= since
    group by 1
  )
  select w.week_start,
         coalesce(s.n, 0)::integer,
         coalesce(k.n, 0)::integer
  from weeks w
  left join new_shops s on s.week_start = w.week_start
  left join booked k on k.week_start = w.week_start
  order by w.week_start;
end;
$$;

revoke all on function public.platform_weekly_activity(integer) from public;
grant execute on function public.platform_weekly_activity(integer) to authenticated;

-- 3. Income by month --------------------------------------------------------------------
-- The payments by the month of their day of payment, without the voided ones
-- (as P-06 already counted them). A payment of a deleted establishment was
-- still money received: it counts.

create function public.platform_monthly_revenue(p_months integer default 12)
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
  paid as (
    select date_trunc('month', s.paid_on)::date as month_start,
           sum(s.amount_cop) as total,
           count(*) as n
    from public.subscription_payments s
    where s.voided_at is null
      and s.paid_on >= first_month
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

revoke all on function public.platform_monthly_revenue(integer) from public;
grant execute on function public.platform_monthly_revenue(integer) to authenticated;

-- 4. By kind of establishment (task 7.2) ------------------------------------------------
-- How many establishments of each kind, and how many appointments they got in
-- the last 4 weeks (28 days up to now). Every kind comes back, and the ones
-- without a kind (accounts from before task 7.2) as a null kind.

create function public.platform_business_types()
returns table (
  business_type public.business_type,
  establishments integer,
  recent_appointments integer
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
  with kinds as (
    select k as kind, ord
    from unnest(enum_range(null::public.business_type)) with ordinality as e(k, ord)
    union all
    select null::public.business_type, 1000
  ),
  shops as (
    select b.business_type as kind, count(*) as n
    from public.barbershops b
    where b.deleted_at is null
    group by 1
  ),
  booked as (
    select b.business_type as kind, count(*) as n
    from public.appointments a
    join public.barbershops b on b.id = a.barbershop_id
    where b.deleted_at is null
      and a.created_at >= now() - interval '28 days'
    group by 1
  )
  select k.kind,
         coalesce(s.n, 0)::integer,
         coalesce(a.n, 0)::integer
  from kinds k
  left join shops s on s.kind is not distinct from k.kind
  left join booked a on a.kind is not distinct from k.kind
  order by k.ord;
end;
$$;

revoke all on function public.platform_business_types() from public;
grant execute on function public.platform_business_types() to authenticated;
