-- Task 5.6, migration add_price_by_barbers: the price depends on the active
-- barbers of a barbershop: $25.000 from 1 to 4, $40.000 from 5 to 8, and an
-- agreed price from 9. The tier is measured when a payment is registered.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000064cc', 'nadie-p@example.com'),
  ('00000000-0000-0000-0000-0000000064aa', 'owner-p@example.com'),
  ('00000000-0000-0000-0000-0000000064bb', 'owner-q@example.com'),
  ('00000000-0000-0000-0000-0000000064ad', 'admin-p@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-0000000064cc', 'Nadie P', '+573001110003', false),
  ('00000000-0000-0000-0000-0000000064aa', 'Dueño P', '+573001110001', false),
  ('00000000-0000-0000-0000-0000000064bb', 'Dueño Q', '+573001110002', false),
  ('00000000-0000-0000-0000-0000000064ad', 'Admin P', null, true);

-- Three barbershops created 3 days ago, in their trial: with 0, 5 and 9
-- active barbers (and one inactive in the second).
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000641', 'Barbería Sola', 'precio-sola', '+573001110001',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000642', 'Barbería Mediana', 'precio-mediana', '+573001110001',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000643', 'Barbería Grande', 'precio-grande', '+573001110002',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-0000000064aa', 'aaaaaaaa-0000-0000-0000-000000000641', 'owner'),
  ('00000000-0000-0000-0000-0000000064aa', 'aaaaaaaa-0000-0000-0000-000000000642', 'owner'),
  ('00000000-0000-0000-0000-0000000064bb', 'aaaaaaaa-0000-0000-0000-000000000643', 'owner');
update public.barbershops set selected_plan = 'plus' where id = 'aaaaaaaa-0000-0000-0000-000000000642';
update public.barbershops set selected_plan = 'por_acuerdo' where id = 'aaaaaaaa-0000-0000-0000-000000000643';
insert into public.barbers (barbershop_id, display_name, link_token_hash, sort_order, active)
select shop, 'Barbero ' || n, encode(sha256(convert_to(shop::text || n, 'UTF8')), 'hex'), n, active
from (values
  ('aaaaaaaa-0000-0000-0000-000000000642'::uuid, 6),
  ('aaaaaaaa-0000-0000-0000-000000000643'::uuid, 9)
) s (shop, total)
cross join lateral generate_series(1, total) n
cross join lateral (select not (shop = 'aaaaaaaa-0000-0000-0000-000000000642' and n = 6) as active) a;

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

-- The catalog ---------------------------------------------------------------------------------------

select results_eq(
  $$select code, monthly_price_cop, min_barbers, max_barbers, by_agreement from public.plans where active order by sort_order$$,
  $$values ('standard', 25000, 1, 4, false), ('plus', 40000, 5, 8, false), ('por_acuerdo', null::integer, 9, null::integer, true)$$,
  'three tiers: $25.000 up to 4 barbers, $40.000 from 5 to 8, agreed from 9'
);
select throws_ok(
  $$insert into public.plans (code, name, monthly_price_cop, included_barbers, by_agreement) values ('raro', 'Raro', null, 1, false)$$,
  '23514', null, 'a plan has a price, or its price is agreed'
);
select is(
  (select count(*)::int from generate_series(1, 60) n
   where (select count(*) from public.plans p
          where p.active and n >= p.min_barbers and (p.max_barbers is null or n <= p.max_barbers)) <> 1),
  0, 'every number of barbers falls in exactly one active plan'
);
select ok(
  not has_table_privilege('service_role', 'public.plans', 'INSERT')
    and not has_table_privilege('service_role', 'public.plans', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.plans', 'INSERT'),
  'no API role writes the catalog, not even the server key'
);

-- What each one pays --------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000064aa", "role": "authenticated"}';
select is(
  (select row(plan_code, price_cop, active_barbers)::text from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000641')),
  '(standard,25000,0)', 'a barbershop with no barbers yet pays the first tier'
);
select is(
  (select row(plan_code, price_cop, active_barbers)::text from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000642')),
  '(plus,25000,5)', 'the chosen plan sets the plan; its first payment is $25.000; an inactive barber does not count'
);
select is(
  pg_temp.hint_of($$select * from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000643')$$),
  '42501', 'an owner never reads the quote of another barbershop'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000064bb", "role": "authenticated"}';
select is(
  (select row(plan_code, price_cop, by_agreement, active_barbers)::text from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000643')),
  '(por_acuerdo,,t,9)', 'nine barbers: the price is agreed'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000064cc", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$select * from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000641')$$),
  '42501', 'nor does a session that is not a member'
);
reset role;
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select is(
  (select price_cop from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000642')),
  25000, 'the server key reads it, for the emails'
);
reset role;
select ok(
  not has_function_privilege('anon', 'public.subscription_quote(uuid)', 'EXECUTE'),
  'anon never reads a quote'
);

-- Registering a payment -----------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000064ad", "role": "authenticated"}';
select is(
  (select amount_cop from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000641', 'standard', 'nequi', 'P-1')),
  25000, 'the first tier pays $25.000'
);
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000642', 'standard', 'nequi', 'P-2')$$),
  'plan_changed', 'a payment for a tier that no longer applies is refused, so the screen shows the new price'
);
select is(
  (select row(plan, amount_cop, active_barbers)::text from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000642', 'plus', 'nequi', 'P-2')),
  '(plus,25000,5)', 'the first payment of plus is $25.000, and the payment keeps how many were counted'
);
select is(
  (select plan from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000642'),
  'plus', 'and the barbershop is on that plan'
);
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000643', 'por_acuerdo', 'nequi', 'P-3')$$),
  'agreed_amount_required', 'an agreed plan needs its amount'
);
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000643', 'por_acuerdo', 'nequi', 'P-3', null, 39999)$$),
  'agreed_amount_required', 'of at least $40.000, never less than 5 to 8 barbers'
);
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000643', 'por_acuerdo', 'nequi', 'P-3', null, 5000001)$$),
  'agreed_amount_required', 'and at most $5.000.000'
);
select is(
  (select row(plan, amount_cop)::text from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000643', 'por_acuerdo', 'nequi', 'P-3', null, 120000)),
  '(por_acuerdo,120000)', 'nine barbers pay what was agreed'
);
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000641', 'standard', 'bre_b', 'P-4', null, 1)$$),
  'price_changed', 'a fixed price refuses an amount that is not the one that applies'
);
select is(
  (select amount_cop from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000641', 'standard', 'bre_b', 'P-4', null, 25000)),
  25000, 'and takes the amount that applies'
);
reset role;

select * from finish();
rollback;
