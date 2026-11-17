-- Task 7.8a, migration add_plan_choice: the 30-day trial, the plan chosen at
-- sign-up (selected_plan), the limit of active professionals per plan and the
-- price that comes from the chosen plan.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(57);

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

-- Active barbers numbered from_n to to_n for a barbershop (as the table owner).
create function pg_temp.add_barbers(shop uuid, from_n integer, to_n integer)
returns void
language sql
as $$
  insert into public.barbers (barbershop_id, display_name, link_token_hash, sort_order, active)
  select shop, 'Barbero ' || n, encode(sha256(convert_to(shop::text || n, 'UTF8')), 'hex'), n, true
  from generate_series(from_n, to_n) n
$$;

select is(
  private.new_trial_expires_on(),
  private.today_bogota() + 30,
  'the trial lasts 30 days'
);

-- Sign-ups ---------------------------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000008101', 'sin-plan@example.com',
   '{"owner_name": "Sin Plan", "barbershop_name": "Sin Plan", "barbershop_slug": "reg-sin-plan", "phone": "+573001810101"}'),
  ('00000000-0000-0000-0000-000000008102', 'estandar@example.com',
   '{"owner_name": "Estandar", "barbershop_name": "Estandar", "barbershop_slug": "reg-estandar", "phone": "+573001810102", "plan": "standard"}'),
  ('00000000-0000-0000-0000-000000008103', 'acuerdo@example.com',
   '{"owner_name": "Acuerdo", "barbershop_name": "Acuerdo", "barbershop_slug": "reg-acuerdo", "phone": "+573001810103", "plan": "por_acuerdo"}'),
  ('00000000-0000-0000-0000-000000008104', 'basura@example.com',
   '{"owner_name": "Basura", "barbershop_name": "Basura", "barbershop_slug": "reg-basura", "phone": "+573001810104", "plan": "xyz; drop table"}'),
  ('00000000-0000-0000-0000-000000008105', 'plus@example.com',
   '{"owner_name": "Plus", "barbershop_name": "Plus", "barbershop_slug": "reg-plus", "phone": "+573001810105", "plan": "plus", "subscription_status": "active"}');

select is(
  (select row(selected_plan, subscription_status::text, expires_on = private.today_bogota() + 30, trial_ends_on = expires_on)::text
   from public.barbershops where slug = 'reg-sin-plan'),
  '(standard,trial,t,t)', 'a sign-up without a plan is standard, in its 30-day trial'
);
select is(
  (select row(selected_plan, subscription_status::text, expires_on = private.today_bogota() + 30, plan is null)::text
   from public.barbershops where slug = 'reg-estandar'),
  '(standard,trial,t,t)', 'a sign-up with standard is standard, in its trial'
);
select is(
  (select row(selected_plan, subscription_status::text, expires_on = private.today_bogota() + 30, plan is null)::text
   from public.barbershops where slug = 'reg-acuerdo'),
  '(standard,trial,t,t)', 'a sign-up can not choose the agreed plan'
);
select is(
  (select row(selected_plan, subscription_status::text, expires_on = private.today_bogota() + 30, plan is null)::text
   from public.barbershops where slug = 'reg-basura'),
  '(standard,trial,t,t)', 'a plan that does not exist is standard'
);
select is(
  (select row(selected_plan, subscription_status::text, plan is null,
              trial_ends_on = (created_at at time zone 'America/Bogota')::date - 1,
              expires_on = (created_at at time zone 'America/Bogota')::date - 1)::text
   from public.barbershops where slug = 'reg-plus'),
  '(plus,trial,t,t,t)',
  'plus starts without a trial, never writes the paid plan and the metadata never sets the status'
);
select is(
  (select private.barbershop_phase(
     b.subscription_status, b.plan, b.trial_ends_on, b.expires_on, (b.created_at at time zone 'America/Bogota')::date)
   from public.barbershops b where slug = 'reg-plus'),
  'awaiting_first_payment', 'a plus sign-up waits for its first payment'
);
select is(
  (select private.barbershop_phase(
     b.subscription_status, b.plan, b.trial_ends_on, b.expires_on, (b.created_at at time zone 'America/Bogota')::date)
   from public.barbershops b where slug = 'reg-estandar'),
  'active', 'a standard sign-up is open in its trial'
);

-- A barbershop opened later takes the plan of the first --------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008105", "role": "authenticated"}';
select lives_ok(
  $$select public.create_barbershop('Plus Dos', 'reg-plus-dos', null)$$,
  'the plus owner opens another barbershop'
);
select is(
  (select selected_plan from public.barbershops where slug = 'reg-plus-dos'),
  'plus', 'the new barbershop takes the plan of the first one'
);

-- No session changes the plan -----------------------------------------------------------------------

select throws_ok(
  $$update public.barbershops set selected_plan = 'standard' where slug = 'reg-plus'$$,
  '42501', null, 'an owner can not change selected_plan'
);
select throws_ok(
  $$update public.barbershops set selected_plan = 'por_acuerdo' where slug = 'reg-plus'$$,
  '42501', null, 'nor choose the agreed plan'
);
reset role;
select is(
  (select selected_plan from public.barbershops where slug = 'reg-plus'),
  'plus', 'and the plan stays'
);

-- The limit of professionals ---------------------------------------------------------------------

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, selected_plan) values
  ('aaaaaaaa-0000-0000-0000-000000000811', 'Límite Estándar', 'lim-estandar', '+573001810111',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 'standard'),
  ('aaaaaaaa-0000-0000-0000-000000000812', 'Límite Plus', 'lim-plus', '+573001810112',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 'plus'),
  ('aaaaaaaa-0000-0000-0000-000000000813', 'Límite Acuerdo', 'lim-acuerdo', '+573001810113',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 'por_acuerdo');

select lives_ok(
  $$select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000000811', 1, 4)$$,
  'standard allows 4 active professionals'
);
select throws_ok(
  $$select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000000811', 5, 5)$$,
  '23514', null, 'the fifth one is refused'
);
select is(
  pg_temp.hint_of($$select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000000811', 5, 5)$$),
  'plan_limit', 'with the plan_limit hint'
);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order, active) values
  ('ba000000-0000-0000-0000-000000008111', 'aaaaaaaa-0000-0000-0000-000000000811', 'Inactivo',
   encode(sha256(convert_to('inactivo81', 'UTF8')), 'hex'), 9, false);
select is(
  pg_temp.hint_of($$update public.barbers set active = true where id = 'ba000000-0000-0000-0000-000000008111'$$),
  'plan_limit', 'reactivating one over the limit is refused too'
);
select lives_ok(
  $$update public.barbers set display_name = 'Otro nombre' where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000811' and sort_order = 1$$,
  'editing one that is already active is not limited'
);
update public.barbers set active = false
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000811' and sort_order = 4;
select lives_ok(
  $$update public.barbers set active = true where id = 'ba000000-0000-0000-0000-000000008111'$$,
  'deactivating one makes room to reactivate another'
);
select is(
  (select count(*)::int from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000811' and active),
  4, 'and the barbershop keeps 4 active'
);

select lives_ok(
  $$select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000000812', 1, 8)$$,
  'plus allows 8 active professionals'
);
select is(
  pg_temp.hint_of($$select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000000812', 9, 9)$$),
  'plan_limit', 'the ninth is refused in plus'
);
select lives_ok(
  $$select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000000813', 1, 10)$$,
  'the agreed plan has no limit'
);

-- What each one pays ---------------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000081ad', 'admin-81@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-0000000081ad', 'Admin 81', null, true);

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, selected_plan) values
  ('aaaaaaaa-0000-0000-0000-000000000821', 'Cobro Plus', 'cobro-plus', '+573001810121',
   private.today_bogota() - 3, private.today_bogota() - 3, now() - interval '2 days', 'plus'),
  ('aaaaaaaa-0000-0000-0000-000000000822', 'Cobro Estándar', 'cobro-estandar', '+573001810122',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '2 days', 'standard'),
  ('aaaaaaaa-0000-0000-0000-000000000823', 'Cobro Acuerdo', 'cobro-acuerdo', '+573001810123',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '2 days', 'por_acuerdo'),
  ('aaaaaaaa-0000-0000-0000-000000000824', 'Cobro Anulado', 'cobro-anulado', '+573001810124',
   private.today_bogota() - 3, private.today_bogota() - 3, now() - interval '2 days', 'plus');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000081ad", "role": "authenticated"}';

select is(
  (select row(plan_code, price_cop, by_agreement)::text from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000821')),
  '(plus,25000,f)', 'plus without payments quotes its first payment: $25.000'
);
select is(
  (select row(plan_code, price_cop, by_agreement)::text from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000822')),
  '(standard,25000,f)', 'standard quotes $25.000'
);
select is(
  (select row(plan_code, price_cop, by_agreement)::text from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000823')),
  '(por_acuerdo,,t)', 'the agreed plan has no price, it is by agreement'
);

-- Registering payments
select is(
  (select amount_cop from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000821', 'plus', 'nequi', 'PL-1')),
  25000, 'the first payment of plus is $25.000'
);
reset role;
select is(
  (select private.barbershop_phase(b.subscription_status, b.plan, b.trial_ends_on, b.expires_on, (b.created_at at time zone 'America/Bogota')::date)
   from public.barbershops b where b.id = 'aaaaaaaa-0000-0000-0000-000000000821'),
  'active', 'and it leaves the barbershop active'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000081ad", "role": "authenticated"}';
select is(
  (select price_cop from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000821')),
  40000, 'with a payment that stands, plus quotes $40.000'
);
select is(
  (select amount_cop from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000821', 'plus', 'nequi', 'PL-2')),
  40000, 'the second payment of plus is $40.000'
);
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000821', 'standard', 'nequi', 'PL-3')$$),
  'plan_changed', 'a payment for a plan other than the chosen one is refused'
);
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000823', 'por_acuerdo', 'nequi', 'PA-1')$$),
  'agreed_amount_required', 'the agreed plan needs its amount'
);
select is(
  (select amount_cop from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000823', 'por_acuerdo', 'nequi', 'PA-1', null, 90000)),
  90000, 'and takes the amount agreed'
);

-- A voided only payment: the first price again
select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000824', 'plus', 'nequi', 'AN-1');
select is(
  (select price_cop from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000824')),
  40000, 'plus with a payment that stands quotes $40.000'
);
select public.void_subscription_payment(
  'aaaaaaaa-0000-0000-0000-000000000824',
  (select id from public.subscription_payments where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000824'),
  'Error de captura');
select is(
  (select price_cop from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000000824')),
  25000, 'with its only payment voided, plus quotes $25.000 again'
);

-- The admin decides the free days of a plus that waits for its first payment
reset role;
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, selected_plan) values
  ('aaaaaaaa-0000-0000-0000-000000000825', 'Días Gratis', 'dias-gratis', '+573001810125',
   private.today_bogota() - 1, private.today_bogota() - 1, now(), 'plus');
select is(
  (select private.barbershop_phase(b.subscription_status, b.plan, b.trial_ends_on, b.expires_on, (b.created_at at time zone 'America/Bogota')::date)
   from public.barbershops b where b.id = 'aaaaaaaa-0000-0000-0000-000000000825'),
  'awaiting_first_payment', 'a plus barbershop waits for its first payment'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000081ad", "role": "authenticated"}';
select lives_ok(
  $$select public.extend_trial('aaaaaaaa-0000-0000-0000-000000000825', (now() at time zone 'America/Bogota')::date + 7)$$,
  'the super admin gives free days to a plus that waits for its first payment'
);
reset role;
select is(
  (select private.barbershop_phase(b.subscription_status, b.plan, b.trial_ends_on, b.expires_on, (b.created_at at time zone 'America/Bogota')::date)
   from public.barbershops b where b.id = 'aaaaaaaa-0000-0000-0000-000000000825'),
  'active', 'and it opens'
);

-- price_changed: a fixed plan refuses an amount that is not the one that applies ----------

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, selected_plan) values
  ('aaaaaaaa-0000-0000-0000-000000000826', 'Precio Cambia', 'precio-cambia', '+573001810126',
   private.today_bogota() - 3, private.today_bogota() - 3, now() - interval '2 days', 'plus');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000081ad", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000826', 'plus', 'nequi', 'PC-1', null, 40000)$$),
  'price_changed', 'plus without payments refuses $40.000: its first payment is $25.000'
);
select is(
  (select amount_cop from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000826', 'plus', 'nequi', 'PC-1', null, 25000)),
  25000, 'and takes $25.000'
);
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000826', 'plus', 'nequi', 'PC-2', null, 25000)$$),
  'price_changed', 'with a payment that stands, $25.000 is refused'
);
select is(
  (select amount_cop from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000826', 'plus', 'nequi', 'PC-2', null, 40000)),
  40000, 'and $40.000 is taken'
);
select is(
  (select amount_cop from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000826', 'plus', 'nequi', 'PC-3', null, null)),
  40000, 'a null amount is not compared: the price that applies is charged'
);
reset role;

-- Nobody but the plan code reaches the internal functions ------------------------------------

select ok(
  not has_function_privilege('anon', 'private.next_payment_cop(uuid, public.plans)', 'execute')
  and not has_function_privilege('authenticated', 'private.next_payment_cop(uuid, public.plans)', 'execute'),
  'anon and authenticated cannot run next_payment_cop'
);
select ok(
  not has_function_privilege('anon', 'private.enforce_plan_limit()', 'execute')
  and not has_function_privilege('authenticated', 'private.enforce_plan_limit()', 'execute'),
  'nor enforce_plan_limit'
);
select ok(
  not has_function_privilege('anon', 'private.record_selected_plan()', 'execute')
  and not has_function_privilege('authenticated', 'private.record_selected_plan()', 'execute'),
  'nor record_selected_plan'
);
select ok(
  not has_function_privilege('anon', 'private.inherit_selected_plan()', 'execute')
  and not has_function_privilege('authenticated', 'private.inherit_selected_plan()', 'execute'),
  'nor inherit_selected_plan'
);

-- The limit and the dates, seen from an owner's session --------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000008131', 'dueno-81a@example.com'),
  ('00000000-0000-0000-0000-000000008132', 'dueno-81b@example.com'),
  ('00000000-0000-0000-0000-000000008133', 'dueno-81c@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-000000008131', 'Dueño 81a', '+573001810131', false),
  ('00000000-0000-0000-0000-000000008132', 'Dueño 81b', '+573001810132', false),
  ('00000000-0000-0000-0000-000000008133', 'Dueño 81c', '+573001810133', false);
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at, selected_plan, latitude, longitude) values
  ('aaaaaaaa-0000-0000-0000-000000000831', 'Dueño Cuatro', 'dueno-cuatro', '+573001810131',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 'standard', 3.4516, -76.532),
  ('aaaaaaaa-0000-0000-0000-000000000832', 'Asistente Cinco', 'asistente-cinco', '+573001810132',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 'standard', 3.4516, -76.532),
  ('aaaaaaaa-0000-0000-0000-000000000833', 'Asistente Cuatro', 'asistente-cuatro', '+573001810133',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days', 'standard', 3.4516, -76.532);
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000008131', 'aaaaaaaa-0000-0000-0000-000000000831', 'owner'),
  ('00000000-0000-0000-0000-000000008132', 'aaaaaaaa-0000-0000-0000-000000000832', 'owner'),
  ('00000000-0000-0000-0000-000000008133', 'aaaaaaaa-0000-0000-0000-000000000833', 'owner');
select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000000831', 1, 4);

create temp table setup_input (hours jsonb, services jsonb, five jsonb, four jsonb);
grant select on setup_input to authenticated;
insert into setup_input values (
  '[{"weekday": 1, "start_time": "09:00", "end_time": "20:00"}]',
  '[{"key": "s1", "name": "Corte", "price_cop": 25000, "duration_minutes": 40}]',
  '[{"display_name": "Dueño", "email": null, "is_owner": true, "service_keys": ["s1"]},
    {"display_name": "P1", "email": null, "is_owner": false, "service_keys": ["s1"]},
    {"display_name": "P2", "email": null, "is_owner": false, "service_keys": ["s1"]},
    {"display_name": "P3", "email": null, "is_owner": false, "service_keys": ["s1"]},
    {"display_name": "P4", "email": null, "is_owner": false, "service_keys": ["s1"]}]',
  '[{"display_name": "Dueño", "email": null, "is_owner": true, "service_keys": ["s1"]},
    {"display_name": "P1", "email": null, "is_owner": false, "service_keys": ["s1"]},
    {"display_name": "P2", "email": null, "is_owner": false, "service_keys": ["s1"]},
    {"display_name": "P3", "email": null, "is_owner": false, "service_keys": ["s1"]}]'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008131", "role": "authenticated"}';
select throws_ok(
  $$insert into public.barbers (barbershop_id, display_name, sort_order)
    values ('aaaaaaaa-0000-0000-0000-000000000831', 'Quinto', 5)$$,
  '23514', null, 'an owner with 4 active in standard cannot insert a fifth through the table'
);
select is(
  pg_temp.hint_of($$insert into public.barbers (barbershop_id, display_name, sort_order)
    values ('aaaaaaaa-0000-0000-0000-000000000831', 'Quinto', 5)$$),
  'plan_limit', 'with the plan_limit hint'
);
select throws_ok(
  $$update public.barbershops set trial_ends_on = trial_ends_on + 30 where id = 'aaaaaaaa-0000-0000-0000-000000000831'$$,
  '42501', null, 'an owner cannot change trial_ends_on'
);
select throws_ok(
  $$update public.barbershops set expires_on = expires_on + 30 where id = 'aaaaaaaa-0000-0000-0000-000000000831'$$,
  '42501', null, 'nor expires_on'
);

-- The wizard: the owner who attends counts, and a refusal leaves nothing behind
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008132", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000832', hours, services, five) from setup_input$$),
  'plan_limit', 'the wizard with the owner and 4 professionals (5) is refused by the plan'
);
reset role;
select is(
  (select setup_completed_at is null from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000832'),
  true, 'the setup is not marked as done'
);
select is(
  (select count(*)::int from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000832'),
  0, 'and no barber was left behind'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008133", "role": "authenticated"}';
select lives_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000833', hours, services, four) from setup_input$$,
  'the wizard with the owner and 3 professionals (4) goes through'
);
reset role;
select is(
  (select row(count(*) filter (where active), count(*) filter (where is_owner))::text
   from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000833'),
  '(4,1)', 'the barbershop has 4 active, the owner among them'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008133", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$insert into public.barbers (barbershop_id, display_name, sort_order)
    values ('aaaaaaaa-0000-0000-0000-000000000833', 'Quinto', 5)$$),
  'plan_limit', 'so the owner row counts and one more is refused'
);
reset role;

select * from finish();
rollback;
