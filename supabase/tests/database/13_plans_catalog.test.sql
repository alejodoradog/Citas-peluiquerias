-- Task 1.9, migration add_plans_catalog (decision 0006): a single plan of
-- 25.000 COP per barbershop per month, kept in a catalog table; each payment
-- covers one month, so billing periods go away.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

select has_table('public', 'plans', 'plans exists');
select hasnt_type('public', 'subscription_plan', 'the plan enum is gone');
select hasnt_type('public', 'billing_period', 'billing periods are gone');
select hasnt_column('public', 'subscription_payments', 'billing_period', 'a payment always covers one month');

select results_eq(
  $$select code, monthly_price_cop, included_barbers from public.plans where code = 'standard'$$,
  $$values ('standard', 25000, 5)$$,
  'the single plan costs 25.000 pesos a month and includes 5 barbers'
);

insert into public.plans (code, name, monthly_price_cop, included_barbers, active)
values ('viejo', 'Plan retirado', 39900, 3, false);

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', current_date + 10);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
insert into public.profiles (id, full_name, is_super_admin) values ('00000000-0000-0000-0000-0000000000ad', 'Admin', true);

select throws_ok(
  $$update public.barbershops set plan = 'oro' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '23503', null,
  'a barbershop cannot point at a plan that does not exist'
);
select throws_ok(
  $$insert into public.subscription_payments (barbershop_id, plan, amount_cop, method, reference, paid_on, covers_from, covers_until, registered_by)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'oro', 25000, 'nequi', 'REF', current_date, current_date, current_date + 30,
            '00000000-0000-0000-0000-0000000000ad')$$,
  '23503', null,
  'a payment cannot point at a plan that does not exist'
);

-- The public sees the active plans; nobody writes the catalog from the API ----------------

set local role anon;

select results_eq(
  $$select code from public.plans order by code$$,
  $$values ('standard')$$,
  'anon reads the active plan and not the retired one'
);
select throws_ok(
  $$insert into public.plans (code, name, monthly_price_cop, included_barbers) values ('gratis', 'Gratis', 1, 99)$$,
  '42501', null,
  'anon cannot create plans'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select count(*)::int from public.plans where code in ('standard', 'viejo')),
  2,
  'a signed-in account reads every plan, retired ones included'
);
select throws_ok(
  $$update public.plans set monthly_price_cop = 1 where code = 'standard'$$,
  '42501', null,
  'a signed-in account cannot change a price'
);
select throws_ok(
  $$delete from public.plans where code = 'standard'$$,
  '42501', null,
  'a signed-in account cannot delete a plan'
);

reset role;

select is(
  (select monthly_price_cop from public.plans where code = 'standard'),
  25000,
  'the price did not change'
);

select * from finish();
rollback;
