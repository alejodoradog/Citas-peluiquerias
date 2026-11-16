-- Task 7.12, migration add_platform_metrics: the platform panel on a computer.
-- The four platform functions answer the super admin only; the counts are made
-- by the database (weeks, months, kinds of establishment).
--
-- The local database may hold rows from other runs, so every count is measured
-- as a difference: a snapshot before the fixtures and another after them.
-- Every date is relative to today in Bogota or to now().
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

-- Fixtures: people ---------------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000008001', 'dueno-80@example.com'),
  ('00000000-0000-0000-0000-000000008002', 'admin-80@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-000000008001', 'Dueño Ochenta', '+573001118001', false),
  ('00000000-0000-0000-0000-000000008002', 'Admin Ochenta', null, true);

-- Snapshots before the fixtures ---------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008002", "role": "authenticated"}';
create temp table w0 as select * from public.platform_weekly_activity(4);
create temp table m0 as select * from public.platform_monthly_revenue(3);
create temp table t0 as select *, row_number() over () as ord from public.platform_business_types();
reset role;

-- Fixtures: establishments --------------------------------------------------------------------------
-- S1 veterinary, created now. S2 other, 14 days ago. S3 no kind, 21 days ago.
-- S4 dentistry, created now and deleted later. S5 barbershop, 40 days ago.

create function pg_temp.new_shop(shop uuid, slug text, created_offset integer, kind public.business_type, other text)
returns uuid
language sql
as $$
  insert into public.barbershops (
    id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, business_type, business_type_other
  )
  values (shop, 'Negocio ' || slug, slug, '+573001118001',
          private.today_bogota() + 10, private.today_bogota() + 10,
          now() + make_interval(days => created_offset), kind, other)
  returning id
$$;

select pg_temp.new_shop('cccccccc-0000-0000-0000-000000008001', 'metricas-80-s1', 0, 'veterinary', null);
select pg_temp.new_shop('cccccccc-0000-0000-0000-000000008002', 'metricas-80-s2', -14, 'other', 'Spa canino');
select pg_temp.new_shop('cccccccc-0000-0000-0000-000000008003', 'metricas-80-s3', -21, null, null);
select pg_temp.new_shop('cccccccc-0000-0000-0000-000000008004', 'metricas-80-s4', 0, 'dentistry', null);
select pg_temp.new_shop('cccccccc-0000-0000-0000-000000008005', 'metricas-80-s5', -40, 'barbershop', null);

insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000008001', 'cccccccc-0000-0000-0000-000000008001', 'owner');

-- One barber (so the first tier applies) and one customer in S1 to S4.
insert into public.barbers (id, barbershop_id, display_name, link_token_hash)
select ('bbbbbbbb-0000-0000-0000-00000000800' || n)::uuid,
       ('cccccccc-0000-0000-0000-00000000800' || n)::uuid,
       'Barbero 80-' || n, repeat(n::text, 64)
from generate_series(1, 4) n;
insert into public.customers (id, barbershop_id, full_name, email, phone)
select ('dddddddd-0000-0000-0000-00000000800' || n)::uuid,
       ('cccccccc-0000-0000-0000-00000000800' || n)::uuid,
       'Cliente 80-' || n, 'cliente-80-' || n || '@example.com', '+57300111800' || n
from generate_series(1, 4) n;

-- Fixtures: payments, through the real function, as the super admin ----------------------------------
-- S1: two payments today, one voided. S4: one payment today (it is deleted
-- later: the money was still received). S5: one payment 31 days ago.

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008002", "role": "authenticated"}';
select public.register_subscription_payment('cccccccc-0000-0000-0000-000000008001', 'standard', 'nequi', 'P80-1');
select public.register_subscription_payment('cccccccc-0000-0000-0000-000000008001', 'standard', 'nequi', 'P80-2');
select public.void_subscription_payment(
  'cccccccc-0000-0000-0000-000000008001',
  (select id from public.platform_payments('cccccccc-0000-0000-0000-000000008001') where reference = 'P80-2'),
  'Prueba ochenta: anulado'
);
select public.register_subscription_payment('cccccccc-0000-0000-0000-000000008004', 'standard', 'nequi', 'P80-3');
select public.register_subscription_payment(
  'cccccccc-0000-0000-0000-000000008005', 'standard', 'nequi', 'P80-4',
  (now() at time zone 'America/Bogota')::date - 31
);
reset role;

update public.barbershops set deleted_at = now() where id = 'cccccccc-0000-0000-0000-000000008004';

-- Fixtures: appointments, with the day they were created ---------------------------------------------
-- A1 S1 now. A2 S1 7 days ago, cancelled. A3 S2 30 days ago (out of the 4 weeks
-- and of the 28 days). A4 S3 now. A5 S4 now (deleted establishment).

insert into public.appointments (
  id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, status, created_at
) values
  ('eeeeeeee-0000-0000-0000-000000008001', 'cccccccc-0000-0000-0000-000000008001',
   'dddddddd-0000-0000-0000-000000008001', 'bbbbbbbb-0000-0000-0000-000000008001',
   now() + interval '10 days', now() + interval '10 days 30 minutes', 25000, 'manual', 'confirmed', now()),
  ('eeeeeeee-0000-0000-0000-000000008002', 'cccccccc-0000-0000-0000-000000008001',
   'dddddddd-0000-0000-0000-000000008001', 'bbbbbbbb-0000-0000-0000-000000008001',
   now() + interval '11 days', now() + interval '11 days 30 minutes', 25000, 'manual', 'cancelled_by_customer',
   now() - interval '7 days'),
  ('eeeeeeee-0000-0000-0000-000000008003', 'cccccccc-0000-0000-0000-000000008002',
   'dddddddd-0000-0000-0000-000000008002', 'bbbbbbbb-0000-0000-0000-000000008002',
   now() + interval '10 days', now() + interval '10 days 30 minutes', 25000, 'manual', 'confirmed',
   now() - interval '30 days'),
  ('eeeeeeee-0000-0000-0000-000000008004', 'cccccccc-0000-0000-0000-000000008003',
   'dddddddd-0000-0000-0000-000000008003', 'bbbbbbbb-0000-0000-0000-000000008003',
   now() + interval '10 days', now() + interval '10 days 30 minutes', 25000, 'manual', 'confirmed', now()),
  ('eeeeeeee-0000-0000-0000-000000008005', 'cccccccc-0000-0000-0000-000000008004',
   'dddddddd-0000-0000-0000-000000008004', 'bbbbbbbb-0000-0000-0000-000000008004',
   now() + interval '10 days', now() + interval '10 days 30 minutes', 25000, 'manual', 'confirmed', now());

-- What the payments of this file add to each month, from the table itself.
create temp table m_expected as
select date_trunc('month', paid_on)::date as month_start,
       sum(amount_cop)::bigint as total_cop,
       count(*)::integer as payments
from public.subscription_payments
where reference like 'P80-%' and voided_at is null
group by 1;

create function pg_temp.hint_of(statement text)
returns text
language plpgsql
as $$
declare
  error_hint text;
begin
  execute statement;
  return 'no error';
exception when others then
  if sqlstate = '42501' then
    return sqlstate;
  end if;
  get stacked diagnostics error_hint = pg_exception_hint;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;
grant execute on function pg_temp.hint_of(text) to authenticated;

-- 1. An owner with a session is refused ---------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008001", "role": "authenticated"}';
select throws_ok($$select * from public.platform_barbershops()$$, '42501', 'not allowed',
  'an owner cannot read the establishments of the platform');
select throws_ok($$select * from public.platform_weekly_activity(4)$$, '42501', 'not allowed',
  'an owner cannot read the weekly activity');
select throws_ok($$select * from public.platform_monthly_revenue(3)$$, '42501', 'not allowed',
  'an owner cannot read the monthly income');
select throws_ok($$select * from public.platform_business_types()$$, '42501', 'not allowed',
  'an owner cannot read the kinds of establishment');
reset role;

-- 2. Anon cannot even run them --------------------------------------------------------------------------

-- The grant itself, not the error: inside the functions anon would get the
-- same 42501 from the super admin check (security review of task 7.12).
select ok(not has_function_privilege('anon', 'public.platform_barbershops(text)', 'execute'),
  'anon cannot run platform_barbershops');
select ok(not has_function_privilege('anon', 'public.platform_weekly_activity(integer)', 'execute'),
  'anon cannot run platform_weekly_activity');
select ok(not has_function_privilege('anon', 'public.platform_monthly_revenue(integer)', 'execute'),
  'anon cannot run platform_monthly_revenue');
select ok(not has_function_privilege('anon', 'public.platform_business_types()', 'execute'),
  'anon cannot run platform_business_types');

-- Snapshots after the fixtures, as the super admin -----------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008002", "role": "authenticated"}';
create temp table b1 as select * from public.platform_barbershops();
create temp table w1 as select * from public.platform_weekly_activity(4);
create temp table m1 as select * from public.platform_monthly_revenue(3);
create temp table t1 as select *, row_number() over () as ord from public.platform_business_types();
create temp table hints as select
  pg_temp.hint_of($$select * from public.platform_weekly_activity(0)$$) as weeks_0,
  pg_temp.hint_of($$select * from public.platform_weekly_activity(53)$$) as weeks_53,
  pg_temp.hint_of($$select * from public.platform_monthly_revenue(0)$$) as months_0,
  pg_temp.hint_of($$select * from public.platform_monthly_revenue(25)$$) as months_25;
reset role;

-- 3. platform_barbershops: the kind of each establishment --------------------------------------------------

select results_eq(
  $$select slug, business_type::text, business_type_other from b1 where slug like 'metricas-80-%' order by slug$$,
  $$values ('metricas-80-s1', 'veterinary', null::text),
           ('metricas-80-s2', 'other', 'Spa canino'),
           ('metricas-80-s3', null, null),
           ('metricas-80-s5', 'barbershop', null)$$,
  'the super admin gets the kind (and the text of "other") of each establishment'
);
select is(
  (select count(*)::int from b1 where slug = 'metricas-80-s4'),
  0, 'a deleted establishment stays out'
);

-- 4. platform_weekly_activity ------------------------------------------------------------------------------

select is((select count(*)::int from w1), 4, 'four weeks come back');
select is(
  (select count(*)::int from w1 where extract(isodow from week_start) = 1),
  4, 'every week starts on a Monday'
);
select is(
  (select max(week_start) from w1),
  date_trunc('week', private.today_bogota())::date,
  'the last week is the one of today in Bogota'
);
select results_eq(
  $$select a.week_start, a.signups - b.signups, a.appointments - b.appointments
    from w1 a join w0 b using (week_start) order by a.week_start$$,
  $$select date_trunc('week', private.today_bogota())::date - 21 + 7 * i, s, k
    from (values (0, 1, 0), (1, 1, 0), (2, 0, 1), (3, 1, 2)) as v (i, s, k)
    order by 1$$,
  'sign-ups (without the deleted) and appointments created each week, cancelled ones included'
);
select is((select weeks_0 from hints), '22023', 'zero weeks is refused');
select is((select weeks_53 from hints), '22023', '53 weeks is refused');

-- 5. platform_monthly_revenue ------------------------------------------------------------------------------

select is((select count(*)::int from m1), 3, 'three months come back');
select is(
  (select count(*)::int from m1 where extract(day from month_start) = 1),
  3, 'every month starts on the 1st'
);
select is(
  (select max(month_start) from m1),
  date_trunc('month', private.today_bogota())::date,
  'the last month is the one of today in Bogota'
);
select results_eq(
  $$select a.month_start, a.total_cop - b.total_cop, a.payments - b.payments
    from m1 a join m0 b using (month_start) order by a.month_start$$,
  $$select m.month_start, coalesce(e.total_cop, 0), coalesce(e.payments, 0)
    from m1 m left join m_expected e using (month_start) order by m.month_start$$,
  'each month adds its payments, without the voided one'
);
select results_eq(
  $$select a.total_cop - b.total_cop, a.payments - b.payments
    from m1 a join m0 b using (month_start)
    where a.month_start = date_trunc('month', private.today_bogota())::date$$,
  $$values (50000::bigint, 2)$$,
  'this month: two payments of $25.000 count (one of a deleted establishment), the voided one does not'
);
select is((select months_0 from hints), '22023', 'zero months is refused');
select is((select months_25 from hints), '22023', '25 months is refused');

-- 6. platform_business_types -------------------------------------------------------------------------------

select results_eq(
  $$select business_type::text from t1 order by ord$$,
  $$select k::text from unnest(array_append(enum_range(null::public.business_type), null::public.business_type)) as e (k)$$,
  'one row per kind, in the order of the enum, and the ones without a kind last'
);
select results_eq(
  $$select a.ord::int, a.business_type::text, a.establishments - b.establishments,
           a.recent_appointments - b.recent_appointments
    from t1 a join t0 b on a.business_type is not distinct from b.business_type
    order by a.ord$$,
  $$values (1, 'barbershop', 1, 0), (2, 'beauty_salon', 0, 0), (3, 'veterinary', 1, 2),
           (4, 'psychology', 0, 0), (5, 'dentistry', 0, 0), (6, 'other', 1, 0), (7, null, 1, 1)$$,
  'establishments by kind (without the deleted) and appointments created in the last 28 days'
);

select * from finish();
rollback;
