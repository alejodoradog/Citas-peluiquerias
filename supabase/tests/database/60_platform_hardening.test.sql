-- Task 5.4b, migration harden_subscription_payments: the findings of the
-- security review of task 5.4.
--
-- - A payment is registered once per method and reference (M1).
-- - Voiding names the barbershop of the payment (B1).
-- - The payment day, the trial extension and deleted barbershops are checked
--   by the database, not only by the app (B2, B3).
-- - An owner reads their payments without who registered or voided them,
--   nor why; the super admin reads that through platform_payments (B4).
-- - Only the super admin, as themselves, voids; no API role updates or
--   deletes a payment (B5).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

-- Fixtures, inserted as the table owner -------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000060a', 'dueno-60@example.com'),
  ('00000000-0000-0000-0000-0000000006ad', 'admin-60@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-00000000060a', 'Dueño Sesenta', '+573001112233', false),
  ('00000000-0000-0000-0000-0000000006ad', 'Admin Sesenta', null, true);

-- A barbershop whose trial ends `trial_offset` days from today, created
-- `created_offset` days from today.
create function pg_temp.new_shop(shop uuid, slug text, trial_offset integer, created_offset integer)
returns uuid
language sql
as $$
  insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at)
  values (shop, 'Barbería ' || slug, slug, '+573001112233',
          private.today_bogota() + trial_offset, private.today_bogota() + trial_offset,
          now() + make_interval(days => created_offset))
  returning id
$$;

-- Old: created 40 days ago, in its trial for 10 more days.
select pg_temp.new_shop('cccccccc-0000-0000-0000-000000000601', 'sede-60-vieja', 10, -40);
-- New: created 5 days ago.
select pg_temp.new_shop('cccccccc-0000-0000-0000-000000000602', 'sede-60-nueva', 10, -5);
-- Deleted.
select pg_temp.new_shop('cccccccc-0000-0000-0000-000000000603', 'sede-60-borrada', 10, -40);
update public.barbershops set deleted_at = now(), subscription_status = 'suspended'
where id = 'cccccccc-0000-0000-0000-000000000603';
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000060a', 'cccccccc-0000-0000-0000-000000000601', 'owner');

-- The hint of the error a statement raises (or its SQLSTATE), or 'no error'.
-- A missing privilege gives its SQLSTATE: Supabase adds its own hint
-- ("Grant the required privileges...") to those errors.
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
-- The Bogotá date `days` from today; a session cannot call private.today_bogota.
create function pg_temp.d(days integer)
returns date
language sql
stable
as $q$
  select (now() at time zone 'America/Bogota')::date + days
$q$;
grant execute on function pg_temp.hint_of(text), pg_temp.d(integer) to authenticated;

-- Structure and privileges ------------------------------------------------------------------------

select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.void_subscription_payment(uuid, uuid, text)'::regprocedure,
     'public.platform_payments(uuid)'::regprocedure
   )),
  'the new functions are security definer with an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.platform_payments(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.void_subscription_payment(uuid, uuid, text)', 'EXECUTE')
    and to_regprocedure('public.void_subscription_payment(uuid, text)') is null,
  'anon calls neither, and the old way to void is gone'
);
select ok(
  not has_table_privilege('service_role', 'public.subscription_payments', 'INSERT')
    and not has_table_privilege('service_role', 'public.subscription_payments', 'UPDATE')
    and not has_table_privilege('service_role', 'public.subscription_payments', 'DELETE')
    and not has_table_privilege('service_role', 'public.subscription_payments', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.subscription_payments', 'UPDATE'),
  'no API role inserts, updates, deletes or truncates a payment (B5)'
);
select ok(
  has_column_privilege('authenticated', 'public.subscription_payments', 'amount_cop', 'SELECT')
    and has_column_privilege('authenticated', 'public.subscription_payments', 'voided_at', 'SELECT')
    and not has_column_privilege('authenticated', 'public.subscription_payments', 'void_reason', 'SELECT')
    and not has_column_privilege('authenticated', 'public.subscription_payments', 'voided_by', 'SELECT')
    and not has_column_privilege('authenticated', 'public.subscription_payments', 'registered_by', 'SELECT'),
  'a session reads a payment, not the platform''s trace (B4)'
);

-- The super admin --------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000006ad", "role": "authenticated"}';

-- M1: once per method and reference.
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000601', 'standard', 'nequi', 'NEQ-60')$$),
  'no error', 'a payment is registered');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000601', 'standard', 'nequi', 'NEQ-60')$$),
  'payment_already_registered', 'the same transfer is not registered twice (M1)');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000601', 'standard', 'nequi', '  neq-60 ')$$),
  'payment_already_registered', 'nor with other spaces or capitals');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000601', 'standard', 'nequi', chr(160) || 'NEQ-60' || chr(9) || chr(10))$$),
  'payment_already_registered', 'nor with tabs, line breaks or non-breaking spaces');
select is(
  (select row(count(*), max(b.expires_on) = (pg_temp.d(10) + interval '1 month')::date)::text
   from public.subscription_payments s join public.barbershops b on b.id = s.barbershop_id
   where s.barbershop_id = 'cccccccc-0000-0000-0000-000000000601'),
  '(1,t)', 'so the barbershop got one month, not two');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000601', 'standard', 'daviplata', 'NEQ-60')$$),
  'no error', 'the same reference by another method is another payment');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000602', 'standard', 'nequi', 'NEQ-60')$$),
  'no error', 'and so it is in another barbershop');

-- B1: voiding names the barbershop of the payment.
select is(
  pg_temp.hint_of($$select public.void_subscription_payment('cccccccc-0000-0000-0000-000000000602',
    (select id from public.subscription_payments where barbershop_id = 'cccccccc-0000-0000-0000-000000000601' and method = 'nequi'),
    'Desde otra ficha')$$),
  'P0002', 'a payment is not voided from the record of another barbershop (B1)');
select is(
  (select count(*)::integer from public.subscription_payments
   where barbershop_id = 'cccccccc-0000-0000-0000-000000000601' and voided_at is not null),
  0, 'and it stays as it was');
select is(
  pg_temp.hint_of($$select public.void_subscription_payment('cccccccc-0000-0000-0000-000000000601',
    (select id from public.subscription_payments where barbershop_id = 'cccccccc-0000-0000-0000-000000000601' and method = 'nequi'),
    'Referencia equivocada')$$),
  'no error', 'from its own record it is voided');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000601', 'standard', 'nequi', 'NEQ-60')$$),
  'no error', 'and its reference can be registered again');

-- B2 and B3: the payment day.
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000601', 'standard', 'bre_b', 'BRB-FUTURO', pg_temp.d(1))$$),
  'payment_day_out_of_range', 'a payment is never in the future');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000601', 'standard', 'bre_b', 'BRB-VIEJO', pg_temp.d(-32))$$),
  'payment_day_out_of_range', 'nor more than 31 days back (decision P8)');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000601', 'standard', 'bre_b', 'BRB-31', pg_temp.d(-31))$$),
  'no error', '31 days back is fine');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000602', 'standard', 'bre_b', 'BRB-ANTES', pg_temp.d(-6))$$),
  'payment_day_out_of_range', 'nor before the barbershop was created (B3)');
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000602', 'standard', 'bre_b', 'BRB-CREADA', pg_temp.d(-5))$$),
  'no error', 'its first day is fine');

-- B2: a deleted barbershop is left alone.
select is(
  array[
    pg_temp.hint_of($$select public.register_subscription_payment('cccccccc-0000-0000-0000-000000000603', 'standard', 'nequi', 'NEQ-BORRADA')$$),
    pg_temp.hint_of($$select public.suspend_barbershop('cccccccc-0000-0000-0000-000000000603')$$),
    pg_temp.hint_of($$select public.reactivate_barbershop('cccccccc-0000-0000-0000-000000000603')$$),
    pg_temp.hint_of($$select public.extend_trial('cccccccc-0000-0000-0000-000000000603', pg_temp.d(20))$$),
    pg_temp.hint_of($$select public.void_subscription_payment('cccccccc-0000-0000-0000-000000000603', gen_random_uuid(), 'Motivo')$$)
  ],
  array['P0002', 'P0002', 'P0002', 'P0002', 'P0002'],
  'a deleted barbershop is not paid, suspended, reactivated, extended or voided'
);

-- B2: extending the trial, 30 days at most past its end.
reset role;
select pg_temp.new_shop('cccccccc-0000-0000-0000-000000000604', 'sede-60-prueba', 10, -3);
select pg_temp.new_shop('cccccccc-0000-0000-0000-000000000605', 'sede-60-terminada', -4, -30);
set local role authenticated;
select is(
  pg_temp.hint_of($$select public.extend_trial('cccccccc-0000-0000-0000-000000000604', pg_temp.d(41))$$),
  'trial_extension_too_long', 'a trial is not extended more than 30 days past its end');
select is(
  pg_temp.hint_of($$select public.extend_trial('cccccccc-0000-0000-0000-000000000604', pg_temp.d(40))$$),
  'no error', '30 days past its end is fine');
select is(
  pg_temp.hint_of($$select public.extend_trial('cccccccc-0000-0000-0000-000000000605', pg_temp.d(30))$$),
  'no error', 'a trial that already ended counts the 30 days from today');
select is(
  pg_temp.hint_of($$select public.extend_trial('cccccccc-0000-0000-0000-000000000605', pg_temp.d(61))$$),
  'trial_extension_too_long', 'and never more');

-- B4: the super admin reads why a payment was voided.
select is(
  (select array_agg(void_reason order by void_reason) filter (where void_reason is not null)
   from public.platform_payments('cccccccc-0000-0000-0000-000000000601')),
  array['Referencia equivocada'],
  'platform_payments gives the super admin why a payment was voided'
);
select is(
  (select count(*)::integer from public.platform_payments('cccccccc-0000-0000-0000-000000000601')),
  4, 'with every payment of that barbershop, voided ones included');

-- The owner ----------------------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000060a", "role": "authenticated"}';

select is(
  (select count(*)::integer from public.subscription_payments
   where barbershop_id = 'cccccccc-0000-0000-0000-000000000601' and voided_at is not null),
  1, 'an owner still sees their payments and which were voided');
select is(
  pg_temp.hint_of($$select void_reason from public.subscription_payments$$),
  '42501', 'but not why (B4)');
select is(
  pg_temp.hint_of($$select * from public.platform_payments('cccccccc-0000-0000-0000-000000000601')$$),
  '42501', 'nor through platform_payments');

-- B5: the guard, even for the table owner ----------------------------------------------------------

reset role;
select is(
  pg_temp.hint_of($$update public.subscription_payments
    set voided_at = now(), voided_by = '00000000-0000-0000-0000-0000000006ad', void_reason = 'Sin sesión'
    where reference = 'BRB-31'$$),
  '42501', 'a void without the super admin''s session is refused (B5)');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000006ad", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$update public.subscription_payments
    set voided_at = now(), voided_by = '00000000-0000-0000-0000-00000000060a', void_reason = 'A nombre de otro'
    where reference = 'BRB-31'$$),
  '42501', 'and so is one recorded in someone else''s name');

select * from finish();
rollback;
