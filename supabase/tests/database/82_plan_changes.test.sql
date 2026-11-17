-- Task 7.8b, migration add_plan_change_requests: "Cambiar plan". The owner asks
-- to move from plan 1 to plan 2 and Yapoin accepts it by registering the payment
-- of the difference; only then the plan changes.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(101);

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

-- Notes the test keeps between sessions.
create temp table ids (label text primary key, id uuid);
grant select, insert on ids to authenticated;
create temp table rev (label text primary key, total bigint, n integer);
grant select, insert on rev to authenticated;

-- Fixtures -------------------------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000008201', 'dueno-82a@example.com'),
  ('00000000-0000-0000-0000-000000008202', 'dueno-82b@example.com'),
  ('00000000-0000-0000-0000-0000000082ad', 'admin-82@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-000000008201', 'Dueño 82a', '+573001820101', false),
  ('00000000-0000-0000-0000-000000008202', 'Dueño 82b', '+573001820102', false),
  ('00000000-0000-0000-0000-0000000082ad', 'Admin 82', null, true);

-- S1 (no payments), S2 (a payment that stands), S3 (already plus), S4 (errors on accept).
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000008211', 'Cambio Uno', 'cambio-uno', '+573001820111',
   (now() at time zone 'America/Bogota')::date + 10, (now() at time zone 'America/Bogota')::date + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000008212', 'Cambio Dos', 'cambio-dos', '+573001820112',
   (now() at time zone 'America/Bogota')::date + 10, (now() at time zone 'America/Bogota')::date + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000008213', 'Cambio Tres', 'cambio-tres', '+573001820113',
   (now() at time zone 'America/Bogota')::date + 10, (now() at time zone 'America/Bogota')::date + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000008214', 'Cambio Cuatro', 'cambio-cuatro', '+573001820114',
   (now() at time zone 'America/Bogota')::date + 10, (now() at time zone 'America/Bogota')::date + 10, now() - interval '3 days');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000008201', 'aaaaaaaa-0000-0000-0000-000000008211', 'owner'),
  ('00000000-0000-0000-0000-000000008202', 'aaaaaaaa-0000-0000-0000-000000008212', 'owner'),
  ('00000000-0000-0000-0000-000000008201', 'aaaaaaaa-0000-0000-0000-000000008213', 'owner'),
  ('00000000-0000-0000-0000-000000008201', 'aaaaaaaa-0000-0000-0000-000000008214', 'owner');
-- After the memberships: inherit_selected_plan sets the plan on each insert.
update public.barbershops set selected_plan = 'plus' where id = 'aaaaaaaa-0000-0000-0000-000000008213';
select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000008211', 1, 4);

-- S5, S6 and S7 for the rules of the security review (M2, M1, B1, B2).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000008203', 'dueno-82c@example.com'),
  ('00000000-0000-0000-0000-000000008204', 'dueno-82d@example.com'),
  ('00000000-0000-0000-0000-000000008205', 'dueno-82e@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-000000008203', 'Dueño 82c', '+573001820103', false),
  ('00000000-0000-0000-0000-000000008204', 'Dueño 82d', '+573001820104', false),
  ('00000000-0000-0000-0000-000000008205', 'Dueño 82e', '+573001820105', false);
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000008215', 'Cambio Cinco', 'cambio-cinco', '+573001820115',
   (now() at time zone 'America/Bogota')::date + 10, (now() at time zone 'America/Bogota')::date + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000008216', 'Cambio Seis', 'cambio-seis', '+573001820116',
   (now() at time zone 'America/Bogota')::date + 10, (now() at time zone 'America/Bogota')::date + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000008217', 'Cambio Siete', 'cambio-siete', '+573001820117',
   (now() at time zone 'America/Bogota')::date + 10, (now() at time zone 'America/Bogota')::date + 10, now() - interval '3 days');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000008203', 'aaaaaaaa-0000-0000-0000-000000008215', 'owner'),
  ('00000000-0000-0000-0000-000000008204', 'aaaaaaaa-0000-0000-0000-000000008216', 'owner'),
  ('00000000-0000-0000-0000-000000008205', 'aaaaaaaa-0000-0000-0000-000000008217', 'owner');
-- A sign-up that chose plus.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000008206', 'dueno-82f@example.com',
   '{"owner_name": "Dueño 82f", "barbershop_name": "Plus 82", "barbershop_slug": "reg82-plus", "phone": "+573001820106", "plan": "plus"}');

-- 1. Permissions -------------------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.request_plan_change(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.cancel_plan_change(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.platform_plan_changes(uuid, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.accept_plan_change(uuid, public.payment_method, text, date, integer)', 'execute')
  and not has_function_privilege('anon', 'public.reject_plan_change(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.void_plan_change(uuid, text)', 'execute'),
  'anon cannot run any of the plan change functions'
);
select ok(
  has_function_privilege('authenticated', 'public.request_plan_change(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.cancel_plan_change(uuid)', 'execute'),
  'authenticated can ask and cancel'
);
select ok(
  not has_function_privilege('anon', 'private.plan_change_cop(uuid, public.plans, public.plans)', 'execute')
  and not has_function_privilege('authenticated', 'private.plan_change_cop(uuid, public.plans, public.plans)', 'execute'),
  'anon and authenticated cannot run plan_change_cop'
);
select ok(
  not has_function_privilege('anon', 'private.guard_plan_change_request()', 'execute')
  and not has_function_privilege('authenticated', 'private.guard_plan_change_request()', 'execute'),
  'nor guard_plan_change_request'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.plan_change_requests'::regclass),
  'plan_change_requests has RLS on'
);

-- A payment that stands in S2, registered by the super admin.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000082ad", "role": "authenticated"}';
select is(
  (select amount_cop from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000008212', 'standard', 'nequi', 'S2-1')),
  25000, 'S2 has a payment that stands'
);

-- 2. Asking --------------------------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008201", "role": "authenticated"}';

select is(
  pg_temp.hint_of($$select public.platform_plan_changes()$$),
  '42501', 'an owner cannot list the requests of the platform'
);
select is(
  pg_temp.hint_of($$select public.accept_plan_change('00000000-0000-0000-0000-000000008299', 'nequi', 'X-1', (now() at time zone 'America/Bogota')::date, 25000)$$),
  '42501', 'an owner cannot accept'
);
select is(
  pg_temp.hint_of($$select public.reject_plan_change('00000000-0000-0000-0000-000000008299', 'No')$$),
  '42501', 'an owner cannot reject'
);
select is(
  pg_temp.hint_of($$select public.void_plan_change('00000000-0000-0000-0000-000000008299', 'No')$$),
  '42501', 'an owner cannot void'
);

select is(
  (select row(status::text, amount_cop, from_plan, to_plan, decided_at is null, method is null)::text
   from public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008211', 'plus')),
  '(pending,25000,standard,plus,t,t)', 'without payments the change costs the first payment of plan 2: $25.000'
);
insert into ids
select 'r1', id from public.plan_change_requests
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008211' and status = 'pending';
select is(
  (select selected_plan from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000008211'),
  'standard', 'asking does not change the plan'
);
select is(
  pg_temp.hint_of($$select public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008211', 'plus')$$),
  'plan_change_pending', 'a second pending request is refused'
);
select is(
  pg_temp.hint_of($$select public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008211', 'por_acuerdo')$$),
  'plan_change_not_offered', 'the agreed plan is not offered'
);
select is(
  pg_temp.hint_of($$select public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008211', 'standard')$$),
  'plan_change_not_offered', 'nor the plan it already has'
);
select is(
  pg_temp.hint_of($$select public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008213', 'plus')$$),
  'plan_change_not_offered', 'a plus barbershop cannot ask to move up'
);

-- 3. Cancelling ----------------------------------------------------------------------------------------

select lives_ok(
  $$select public.cancel_plan_change((select id from ids where label = 'r1'))$$,
  'the owner cancels their pending request'
);
select is(
  (select row(status::text, decided_at is not null, decided_by = '00000000-0000-0000-0000-000000008201')::text
   from public.plan_change_requests where id = (select id from ids where label = 'r1')),
  '(cancelled,t,t)', 'it is cancelled, with its date and who'
);
select is(
  pg_temp.hint_of($$select public.cancel_plan_change((select id from ids where label = 'r1'))$$),
  'P0002', 'a decided request cannot be cancelled again'
);
select lives_ok(
  $$select public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008211', 'plus')$$,
  'after cancelling, the owner can ask again'
);
insert into ids
select 'r2', id from public.plan_change_requests
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008211' and status = 'pending';

select lives_ok(
  $$select public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008214', 'plus')$$,
  'the owner asks for another of their barbershops'
);
insert into ids
select 'r4', id from public.plan_change_requests
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008214' and status = 'pending';

select is(
  (select count(*)::int from public.plan_change_requests
   where barbershop_id in ('aaaaaaaa-0000-0000-0000-000000008211', 'aaaaaaaa-0000-0000-0000-000000008212',
                           'aaaaaaaa-0000-0000-0000-000000008213', 'aaaaaaaa-0000-0000-0000-000000008214')),
  3, 'owner A reads the requests of their barbershops (cancelled, pending and pending)'
);
select is(
  (select count(*)::int from public.plan_change_requests where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008212'),
  0, 'and none of another owner'
);

-- Nobody writes the table directly
select throws_ok(
  $$insert into public.plan_change_requests (barbershop_id, from_plan, to_plan, amount_cop, requested_by)
    values ('aaaaaaaa-0000-0000-0000-000000008211', 'standard', 'plus', 1, '00000000-0000-0000-0000-000000008201')$$,
  '42501', null, 'an owner cannot insert a request directly'
);
select throws_ok(
  $$update public.plan_change_requests set amount_cop = 1$$,
  '42501', null, 'an owner cannot update a request directly'
);
select throws_ok(
  $$delete from public.plan_change_requests$$,
  '42501', null, 'an owner cannot delete a request directly'
);

-- Another owner -------------------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008202", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$select public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008211', 'plus')$$),
  '42501', 'an owner cannot ask for a barbershop that is not theirs'
);
select is(
  (select row(status::text, amount_cop)::text from public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008212', 'plus')),
  '(pending,15000)', 'with a payment that stands the change costs the difference: $15.000'
);
select is(
  (select count(*)::int from public.plan_change_requests),
  1, 'owner B reads only the request of their barbershop'
);
select is(
  pg_temp.hint_of($$select public.cancel_plan_change((select id from ids where label = 'r2'))$$),
  'P0002', 'owner B cannot cancel the request of another barbershop'
);
select throws_ok(
  $$update public.plan_change_requests set status = 'cancelled'$$,
  '42501', null, 'owner B cannot update a request directly either'
);

-- 4 and 6. Yapoin decides ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000082ad", "role": "authenticated"}';

select throws_ok(
  $$insert into public.plan_change_requests (barbershop_id, from_plan, to_plan, amount_cop, requested_by)
    values ('aaaaaaaa-0000-0000-0000-000000008211', 'standard', 'plus', 1, '00000000-0000-0000-0000-0000000082ad')$$,
  '42501', null, 'not even the super admin inserts a request directly'
);
select throws_ok(
  $$update public.plan_change_requests set amount_cop = 1$$,
  '42501', null, 'nor updates one'
);
select throws_ok(
  $$delete from public.plan_change_requests$$,
  '42501', null, 'nor deletes one'
);
select ok(
  (select count(*) from public.plan_change_requests) >= 4,
  'the super admin reads the requests of every barbershop'
);

-- Reject
select lives_ok(
  $$select public.reject_plan_change((select id from ids where label = 'r2'), '  No llegó el pago  ')$$,
  'the super admin rejects a pending request'
);
select is(
  (select row(status::text, reject_reason, decided_at is not null)::text
   from public.plan_change_requests where id = (select id from ids where label = 'r2')),
  '(rejected,"No llegó el pago",t)', 'it is rejected, with its reason'
);
select is(
  pg_temp.hint_of($$select public.reject_plan_change((select id from ids where label = 'r2'), 'Otra vez')$$),
  'P0002', 'a rejected request cannot be rejected again'
);
select is(
  pg_temp.hint_of($$select public.reject_plan_change((select id from ids where label = 'r1'), 'Cancelada')$$),
  'P0002', 'nor a cancelled one'
);
select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r2'), 'nequi', 'RJ-1', (now() at time zone 'America/Bogota')::date, 25000)$$),
  'P0002', 'a rejected request cannot be accepted'
);

-- The owner asks again (R3), on S1
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008201", "role": "authenticated"}';
select lives_ok(
  $$select public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008211', 'plus')$$,
  'after a rejection, the owner can ask again'
);
insert into ids
select 'r3', id from public.plan_change_requests
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008211' and status = 'pending';

-- Accept: the errors, on S4 (R4)
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000082ad", "role": "authenticated"}';
select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000008214', 'standard', 'nequi', 'DUP-1');

select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r4'), 'nequi', 'CP-4', (now() at time zone 'America/Bogota')::date, 25000)$$),
  'price_changed', 'the value kept when it was asked is no longer the current one: refused (M2)'
);
select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r4'), 'nequi', 'CP-4', (now() at time zone 'America/Bogota')::date + 1, 15000)$$),
  'payment_day_out_of_range', 'a payment day in the future is refused'
);
select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r4'), 'nequi', 'CP-4', (now() at time zone 'America/Bogota')::date - 1, 15000)$$),
  'payment_day_out_of_range', 'and one before the day of the request'
);
select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r4'), 'nequi', 'CP-4', null, 15000)$$),
  'payment_day_out_of_range', 'and no day at all'
);
select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r4'), 'nequi', '  dup-1 ', (now() at time zone 'America/Bogota')::date, 15000)$$),
  'payment_already_registered', 'a receipt already registered as a monthly payment is refused'
);
select is(
  (select status::text from public.plan_change_requests where id = (select id from ids where label = 'r4')),
  'pending', 'the refused request is still pending'
);

-- The establishment changed its plan meanwhile
reset role;
update public.barbershops set selected_plan = 'plus' where id = 'aaaaaaaa-0000-0000-0000-000000008214';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000082ad", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r4'), 'nequi', 'CP-4', (now() at time zone 'America/Bogota')::date, 15000)$$),
  'plan_changed', 'a barbershop that is no longer on the plan it left is refused'
);

-- Accept: S1 (R3)
insert into rev
select 'before', total_cop, payments from public.platform_monthly_revenue(1);

select is(
  (select row(status::text, method::text, reference, paid_on = (now() at time zone 'America/Bogota')::date, decided_by = '00000000-0000-0000-0000-0000000082ad', amount_cop)::text
   from public.accept_plan_change((select id from ids where label = 'r3'), 'nequi', ' CP-1 ', (now() at time zone 'America/Bogota')::date, 25000)),
  '(accepted,nequi,CP-1,t,t,25000)', 'the super admin accepts by registering the payment'
);
reset role;
select is(
  (select selected_plan from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000008211'),
  'plus', 'and the barbershop moves to plan 2'
);
select is(
  (select row(plan is null, expires_on = (now() at time zone 'America/Bogota')::date + 10)::text
   from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000008211'),
  '(t,t)', 'without touching the paid plan or the expiry: it is no month'
);
select lives_ok(
  $$select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000008211', 5, 8)$$,
  'plan 2 allows up to 8 active professionals'
);
select is(
  pg_temp.hint_of($$select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000008211', 9, 9)$$),
  'plan_limit', 'the ninth is refused'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000082ad", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r3'), 'nequi', 'CP-2', (now() at time zone 'America/Bogota')::date, 25000)$$),
  'P0002', 'an accepted request cannot be accepted again'
);
select is(
  pg_temp.hint_of($$select public.reject_plan_change((select id from ids where label = 'r3'), 'Tarde')$$),
  'P0002', 'nor rejected'
);

-- 5. The quote ---------------------------------------------------------------------------------------
select is(
  (select row(plan_code, price_cop)::text from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000008211')),
  '(plus,40000)', 'the first month of plan 2 was used by the change: the next payment is $40.000'
);

-- 9. Income --------------------------------------------------------------------------------------------
select is(
  (select row(total_cop - (select total from rev where label = 'before'), payments - (select n from rev where label = 'before'))::text
   from public.platform_monthly_revenue(1)),
  '(25000,1)', 'this month adds the accepted payment of the difference'
);

-- 10. The lists of the super admin -------------------------------------------------------------------
select is(
  array(
    select barbershop_name || ':' || amount_cop::text
    from public.platform_plan_changes(null, true)
    where barbershop_id in ('aaaaaaaa-0000-0000-0000-000000008211', 'aaaaaaaa-0000-0000-0000-000000008212',
                            'aaaaaaaa-0000-0000-0000-000000008213', 'aaaaaaaa-0000-0000-0000-000000008214')
    order by barbershop_name
  ),
  array['Cambio Cuatro:15000', 'Cambio Dos:15000'],
  'the pending ones come with the name of the barbershop and what they cost now (M2)'
);
select is(
  array(
    select status::text from public.platform_plan_changes('aaaaaaaa-0000-0000-0000-000000008211') order by status::text
  ),
  array['accepted', 'cancelled', 'rejected'],
  'by barbershop, every request of it comes'
);
select is(
  (select row(owner_name, from_plan, to_plan, method::text, reference, voided_at is null)::text
   from public.platform_plan_changes('aaaaaaaa-0000-0000-0000-000000008211') where status = 'accepted'),
  '("Dueño 82a",standard,plus,nequi,CP-1,t)', 'with who asked and the payment'
);

-- 8. The guard ------------------------------------------------------------------------------------------
reset role;
select throws_ok(
  $$update public.plan_change_requests set amount_cop = amount_cop + 1 where id = (select id from ids where label = 'r4')$$,
  '42501', null, 'the amount of a request does not change, not even for the table owner'
);
select throws_ok(
  $$update public.plan_change_requests set status = 'accepted', method = 'nequi', reference = 'X-9', paid_on = (now() at time zone 'America/Bogota')::date, decided_at = now()
    where id = (select id from ids where label = 'r1')$$,
  '42501', null, 'a decided request does not change'
);
select throws_ok(
  $$update public.plan_change_requests set reference = 'OTRA' where id = (select id from ids where label = 'r3')$$,
  '42501', null, 'nor its payment'
);
select throws_ok(
  $$delete from public.plan_change_requests where id = (select id from ids where label = 'r4')$$,
  '42501', null, 'a request is not deleted'
);
select throws_ok(
  $$update public.plan_change_requests set to_plan = 'por_acuerdo' where id = (select id from ids where label = 'r4')$$,
  '42501', null, 'nor its plans change'
);

-- 7. Voiding -------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000082ad", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$select public.void_plan_change((select id from ids where label = 'r1'), 'Error')$$),
  'P0002', 'a cancelled request cannot be voided'
);
select is(
  pg_temp.hint_of($$select public.void_plan_change((select id from ids where label = 'r2'), 'Error')$$),
  'P0002', 'nor a rejected one'
);
select is(
  pg_temp.hint_of($$select public.void_plan_change((select id from ids where label = 'r4'), 'Error')$$),
  'P0002', 'nor a pending one'
);
select lives_ok(
  $$select public.void_plan_change((select id from ids where label = 'r3'), '  Error de captura  ')$$,
  'the super admin voids the accepted payment'
);
select is(
  (select row(status::text, voided_at is not null, voided_by = '00000000-0000-0000-0000-0000000082ad', void_reason)::text
   from public.plan_change_requests where id = (select id from ids where label = 'r3')),
  '(accepted,t,t,"Error de captura")', 'the request stays, with its trace'
);
select is(
  pg_temp.hint_of($$select public.void_plan_change((select id from ids where label = 'r3'), 'Otra vez')$$),
  'P0002', 'voiding twice is refused'
);
select is(
  (select row(plan_code, price_cop)::text from public.subscription_quote('aaaaaaaa-0000-0000-0000-000000008211')),
  '(standard,25000)', 'the barbershop is back to plan 1 and its price'
);
select is(
  (select row(total_cop - (select total from rev where label = 'before'), payments - (select n from rev where label = 'before'))::text
   from public.platform_monthly_revenue(1)),
  '(0,0)', 'the voided payment no longer counts as income'
);
reset role;
select is(
  (select selected_plan from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000008211'),
  'standard', 'selected_plan is plan 1 again'
);
select is(
  (select count(*)::int from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008211' and active),
  8, 'its 8 active professionals stay'
);
select is(
  pg_temp.hint_of($$select pg_temp.add_barbers('aaaaaaaa-0000-0000-0000-000000008211', 9, 9)$$),
  'plan_limit', 'but it cannot add one while over the limit'
);
select is(
  (select count(*)::int from public.plan_change_requests where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008211'),
  3, 'no row was deleted'
);

-- A voided change can be asked for again, and costs the same
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008201", "role": "authenticated"}';
select is(
  (select amount_cop from public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008211', 'plus')),
  25000, 'after voiding the change, a new request costs $25.000 again'
);
-- Security review ----------------------------------------------------------------------------------------

-- M2: asked in the trial ($25.000); a monthly payment is registered afterwards,
-- so accepting costs the difference ($15.000), and the value kept is the current one.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008203", "role": "authenticated"}';
select is(
  (select amount_cop from public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008215', 'plus')),
  25000, 'M2: S5 asks in its trial: $25.000'
);
insert into ids select 'r5', id from public.plan_change_requests
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008215' and status = 'pending';
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000082ad", "role": "authenticated"}';
select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000008215', 'standard', 'nequi', 'S5-1');
select is(
  (select amount_cop from public.platform_plan_changes('aaaaaaaa-0000-0000-0000-000000008215', true)),
  15000, 'M2: the pending request shows what it costs now: $15.000'
);
select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r5'), 'nequi', 'CP-5', (now() at time zone 'America/Bogota')::date, 25000)$$),
  'price_changed', 'M2: the value kept when asking is refused'
);
select is(
  (select row(status::text, amount_cop)::text
   from public.accept_plan_change((select id from ids where label = 'r5'), 'nequi', 'CP-5', (now() at time zone 'America/Bogota')::date, 15000)),
  '(accepted,15000)', 'M2: the current value is accepted'
);
select is(
  (select amount_cop from public.plan_change_requests where id = (select id from ids where label = 'r5')),
  15000, 'M2: the row keeps the value paid'
);

-- M2 the other way: asked with a payment that stands ($15.000); it is voided, so it costs $25.000.
select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000008216', 'standard', 'nequi', 'S6-1');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008204", "role": "authenticated"}';
select is(
  (select amount_cop from public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008216', 'plus')),
  15000, 'M2: S6 asks with a payment that stands: $15.000'
);
insert into ids select 'r6', id from public.plan_change_requests
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008216' and status = 'pending';
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000082ad", "role": "authenticated"}';
select lives_ok(
  $$select public.void_subscription_payment('aaaaaaaa-0000-0000-0000-000000008216',
      (select id from public.subscription_payments where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008216' and voided_at is null),
      'Error de captura')$$,
  'M2: the monthly payment of S6 is voided'
);
select is(
  pg_temp.hint_of($$select public.accept_plan_change((select id from ids where label = 'r6'), 'nequi', 'CP-6', (now() at time zone 'America/Bogota')::date, 15000)$$),
  'price_changed', 'M2: the value kept when asking is refused now'
);
select is(
  (select row(status::text, amount_cop)::text
   from public.accept_plan_change((select id from ids where label = 'r6'), 'nequi', 'CP-6', (now() at time zone 'America/Bogota')::date, 25000)),
  '(accepted,25000)', 'M2: the current value is accepted'
);

-- M1: the receipt of an accepted change cannot be registered as a monthly payment.
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000008215', 'plus', 'nequi', ' cp-5 ')$$),
  'payment_already_registered', 'M1: the same method and reference (trimmed, any case) is refused'
);
select lives_ok(
  $$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000008215', 'plus', 'nequi', 'S5-2')$$,
  'M1: another reference is registered'
);

-- B1: a new sede does not inherit a plan the first one reached by a change.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008204", "role": "authenticated"}';
select lives_ok(
  $$select public.create_barbershop('Sede Seis B', 'sede-seis-b', null)$$,
  'B1: the owner of a sede raised by a change opens another'
);
select is(
  (select selected_plan from public.barbershops where slug = 'sede-seis-b'),
  'standard', 'B1: the new sede is plan 1'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008206", "role": "authenticated"}';
select lives_ok(
  $$select public.create_barbershop('Plus 82 Dos', 'reg82-plus-dos', null)$$,
  'B1: the owner who signed up with plus opens another'
);
select is(
  (select selected_plan from public.barbershops where slug = 'reg82-plus-dos'),
  'plus', 'B1: the new sede is plan 2'
);

-- B2: rejecting and voiding need a reason.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008205", "role": "authenticated"}';
select lives_ok(
  $$select public.request_plan_change('aaaaaaaa-0000-0000-0000-000000008217', 'plus')$$,
  'B2: S7 asks'
);
insert into ids select 'r7', id from public.plan_change_requests
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000008217' and status = 'pending';
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000082ad", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$select public.reject_plan_change((select id from ids where label = 'r7'), null)$$),
  '22023', 'B2: rejecting without a reason (null) is refused'
);
select is(
  pg_temp.hint_of($$select public.reject_plan_change((select id from ids where label = 'r7'), '   ')$$),
  '22023', 'B2: nor with a blank one'
);
select is(
  pg_temp.hint_of($$select public.void_plan_change((select id from ids where label = 'r5'), null)$$),
  '22023', 'B2: voiding without a reason (null) is refused'
);
select is(
  pg_temp.hint_of($$select public.void_plan_change((select id from ids where label = 'r5'), '   ')$$),
  '22023', 'B2: nor with a blank one'
);
select is(
  (select (select status::text from public.plan_change_requests where id = (select id from ids where label = 'r7'))
       || ',' || (select (voided_at is null)::text from public.plan_change_requests where id = (select id from ids where label = 'r5'))),
  'pending,true', 'B2: nothing changed'
);

-- The guard: the value only changes when a pending request is accepted.
reset role;
select throws_ok(
  $$update public.plan_change_requests set amount_cop = 1 where id = (select id from ids where label = 'r7')$$,
  '42501', null, 'a pending request keeps its value unless it is accepted'
);
select throws_ok(
  $$update public.plan_change_requests set amount_cop = 1 where id = (select id from ids where label = 'r5')$$,
  '42501', null, 'an accepted request does not change its value'
);

reset role;

select * from finish();
rollback;
