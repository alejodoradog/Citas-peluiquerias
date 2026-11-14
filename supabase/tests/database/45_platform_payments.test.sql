-- Task 5.4, migration add_subscription_payment_flow (decision 0006, "### 9.").
--
-- - A payment is one month at the plan's price; the validity is replayed from
--   the trial and the non-voided payments with the spec's date rule.
-- - Payments are never edited or deleted; voiding leaves a trace and
--   recomputes. A payment lifts a manual suspension; a void does not.
-- - Reactivar lifts a suspension only while the validity covers; extend_trial
--   works only during the trial and only forward.
-- - Only the super admin reaches these functions and platform_barbershops.
-- - The two blocks of cases below are read by
--   src/modulos/suscripciones/dominio/subscription.test.ts, so the copy of the
--   rules in TypeScript must give the same answers.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(44);

-- Fixtures, inserted as the table owner -------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dueno-a@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño Uno', '+573001112233', false),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', null, true);

-- A trial that ends in 10 days, created 3 days ago.
create function pg_temp.new_shop(shop uuid, slug text, trial_offset integer, created_offset integer default -3)
returns uuid
language sql
as $$
  insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at)
  values (shop, 'Barbería ' || slug, slug, '+573001112233',
          private.today_bogota() + trial_offset, private.today_bogota() + trial_offset,
          now() + make_interval(days => created_offset))
  returning id
$$;

select pg_temp.new_shop('aaaaaaaa-0000-0000-0000-000000000001', 'sede-pagos', 10);
select pg_temp.new_shop('aaaaaaaa-0000-0000-0000-000000000002', 'sede-borrada', 10);
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner');
update public.barbershops set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- The hint of the error a statement raises (or its SQLSTATE), or 'no error'.
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

-- The date rule (spec, "Regla de fechas") --------------------------------------------------------
-- casos de la fórmula: name, trial_ends_on, paid_on of each payment (in the
-- order they are registered), expected expires_on.
create temporary table formula_cases (name text, trial_ends_on date, paid_on date[], expires_on date);
insert into formula_cases values
  ('pays before expiring: the month is added to the expiry', '2026-11-09', '{2026-11-07}', '2026-12-09'),
  ('pays on the expiry day: the same', '2026-11-09', '{2026-11-09}', '2026-12-09'),
  ('pays after expiring: the month counts from the payment', '2026-11-09', '{2026-11-20}', '2026-12-19'),
  ('a month from January 31 ends on February 28', '2026-01-31', '{2026-01-30}', '2026-02-28'),
  ('paid late on January 31: up to February 27', '2026-01-10', '{2026-01-31}', '2026-02-27'),
  ('two payments before expiring: two months', '2026-11-09', '{2026-11-01,2026-11-05}', '2027-01-09'),
  ('a backdated payment is replayed in date order', '2026-11-09', '{2026-11-20,2026-11-05}', '2027-01-09'),
  ('no payments: the trial', '2026-11-09', '{}', '2026-11-09');
-- fin de los casos de la fórmula

-- A barbershop per case, its payments inserted as registered, and the expiry
-- the recompute leaves.
create function pg_temp.replay(trial date, paid date[], n integer)
returns date
language plpgsql
as $$
declare
  shop uuid := gen_random_uuid();
  day date;
begin
  insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at)
  values (shop, 'Caso ' || n, 'caso-formula-' || n, '+573001112233', trial, trial,
          (trial - 20)::timestamp at time zone 'America/Bogota');
  foreach day in array paid loop
    insert into public.subscription_payments (barbershop_id, plan, amount_cop, method, reference, paid_on,
                                              covers_from, covers_until, registered_by)
    values (shop, 'standard', 25000, 'nequi', 'REF-' || n || '-' || day, day, day, day + 1,
            '00000000-0000-0000-0000-0000000000ad');
  end loop;
  return (select expires_on from public.barbershops where id = shop);
end;
$$;

-- The copy in TypeScript also checks one case the database cannot, below:
-- the first case of the list made its way (a typo here is caught there).
select is(pg_temp.replay(c.trial_ends_on, c.paid_on, c.n), c.expires_on, c.name)
from (select *, row_number() over ()::integer as n from formula_cases) c;

-- The phase (private.barbershop_phase) -------------------------------------------------------------
-- casos de la fase: name, status, plan, trial_ends_on, expires_on and the
-- day the barbershop was created, in days from today; expected phase.
create temporary table phase_cases (name text, status text, plan text, trial_days integer, expires_days integer, created_days integer, phase text);
insert into phase_cases values
  ('a running trial is active', 'trial', null, 10, 10, -3, 'active'),
  ('the fifth day of grace is still active', 'active', 'standard', -40, -5, -60, 'active'),
  ('the sixth day after expiring is expired', 'active', 'standard', -40, -6, -60, 'expired'),
  ('a trial that ended six days ago is expired', 'trial', null, -6, -6, -30, 'expired'),
  ('a suspended barbershop is suspended, whatever its dates', 'suspended', 'standard', -40, 20, -60, 'suspended'),
  ('a sede created after the trial ended awaits its first payment', 'trial', null, -1, -1, 0, 'awaiting_first_payment');
-- fin de los casos de la fase

select is(
  private.barbershop_phase(
    c.status::public.subscription_status, c.plan,
    private.today_bogota() + c.trial_days, private.today_bogota() + c.expires_days,
    private.today_bogota() + c.created_days
  ),
  c.phase,
  c.name
)
from phase_cases c;

-- Structure and privileges ------------------------------------------------------------------------

select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.register_subscription_payment(uuid, text, public.payment_method, text, date)'::regprocedure,
     'public.void_subscription_payment(uuid, text)'::regprocedure,
     'public.suspend_barbershop(uuid)'::regprocedure,
     'public.reactivate_barbershop(uuid)'::regprocedure,
     'public.extend_trial(uuid, date)'::regprocedure,
     'public.platform_barbershops(text)'::regprocedure
   )),
  'the six functions are security definer with an empty search_path'
);
select ok(
  (select bool_and(not has_function_privilege('anon', f, 'EXECUTE'))
   from unnest(array[
     'public.register_subscription_payment(uuid, text, public.payment_method, text, date)',
     'public.void_subscription_payment(uuid, text)',
     'public.suspend_barbershop(uuid)',
     'public.reactivate_barbershop(uuid)',
     'public.extend_trial(uuid, date)',
     'public.platform_barbershops(text)'
   ]) f),
  'anon calls none of them'
);

-- An owner reaches none of them -----------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000001', 'standard', 'nequi', 'REF-DUEÑO')$$),
  '42501', 'an owner cannot register a payment');
select is(
  pg_temp.hint_of($$select public.suspend_barbershop('aaaaaaaa-0000-0000-0000-000000000001')$$),
  '42501', 'nor suspend');
select is(
  pg_temp.hint_of($$select public.extend_trial('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.d(30))$$),
  '42501', 'nor extend the trial');
select is(
  pg_temp.hint_of($$select * from public.platform_barbershops()$$),
  '42501', 'nor list the platform''s barbershops');

-- The super admin --------------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';

select is(
  (select array_agg(name order by name) from public.platform_barbershops() where name like 'Barbería sede-%'),
  array['Barbería sede-pagos'],
  'platform_barbershops lists the barbershops, never a deleted one'
);
select is(
  (select row(owner_name, owner_phone, owner_email, phase)::text
   from public.platform_barbershops('dueno-a@')),
  '("Dueño Uno",+573001112233,dueno-a@example.com,active)',
  'with the owner''s name, phone and email, searched by the email'
);
select is(
  (select count(*)::integer from public.platform_barbershops('%')),
  0,
  'a % in the search is a character, not a wildcard'
);

-- Register: one month at the plan's price, read from the catalog.
select is(
  (select row(amount_cop, reference, registered_by, paid_on = pg_temp.d(0),
              covers_from = pg_temp.d(11), covers_until = (pg_temp.d(10) + interval '1 month')::date)::text
   from public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000001', 'standard', 'nequi', '  NEQ-1  ')),
  '(25000,NEQ-1,00000000-0000-0000-0000-0000000000ad,t,t,t)',
  'a payment is one month at the plan''s price, after the trial, by the super admin'
);
select is(
  (select row(subscription_status, plan, expires_on = (pg_temp.d(10) + interval '1 month')::date)::text
   from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '(active,standard,t)',
  'and the barbershop is active until then'
);
select is(
  pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000001', 'premium', 'nequi', 'REF-X')$$),
  '22023', 'an unknown plan is refused');
select is(
  pg_temp.hint_of($$select public.extend_trial('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.d(60))$$),
  'P0002', 'the trial cannot be extended once there are payments');

-- Never edited, never deleted.
select isnt(
  pg_temp.hint_of($$update public.subscription_payments set amount_cop = 1 where reference = 'NEQ-1'$$),
  'no error', 'a payment is not edited (a session cannot even try)');
reset role;
select is(
  pg_temp.hint_of($$update public.subscription_payments set amount_cop = 1 where reference = 'NEQ-1'$$),
  '42501', 'not even by the table owner');
select is(
  pg_temp.hint_of($$delete from public.subscription_payments where reference = 'NEQ-1'$$),
  '42501', 'nor deleted');
set local role authenticated;

-- A second payment, then voiding the first: the second takes its place.
select pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000001', 'standard', 'bre_b', 'BRB-2')$$);
select is(
  pg_temp.hint_of($$select public.void_subscription_payment((select id from public.subscription_payments where reference = 'NEQ-1'), '   ')$$),
  '23514', 'voiding needs a reason');
select is(
  (select row(voided_by, void_reason)::text
   from public.void_subscription_payment(
     (select id from public.subscription_payments where reference = 'NEQ-1'), ' Pago duplicado ')),
  '(00000000-0000-0000-0000-0000000000ad,"Pago duplicado")',
  'voiding leaves who and why'
);
select is(
  (select row(covers_from = pg_temp.d(11), expires_on = (pg_temp.d(10) + interval '1 month')::date)::text
   from public.subscription_payments s join public.barbershops b on b.id = s.barbershop_id
   where s.reference = 'BRB-2'),
  '(t,t)',
  'and the other payment takes its place'
);
select is(
  pg_temp.hint_of($$select public.void_subscription_payment((select id from public.subscription_payments where reference = 'NEQ-1'), 'Otra vez')$$),
  'P0002', 'a payment is voided once');

-- Suspend; voiding keeps it suspended; a payment lifts it.
select is(pg_temp.hint_of($$select public.suspend_barbershop('aaaaaaaa-0000-0000-0000-000000000001')$$), 'no error', 'the super admin suspends');
select pg_temp.hint_of($$select public.void_subscription_payment((select id from public.subscription_payments where reference = 'BRB-2'), 'Rebotó')$$);
select is(
  (select row(subscription_status, plan, expires_on = pg_temp.d(10))::text
   from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '(suspended,,t)',
  'voiding every payment goes back to the trial, and the suspension stays'
);

-- Reactivar: covered by the trial, so it is lifted without touching dates.
select is(pg_temp.hint_of($$select public.reactivate_barbershop('aaaaaaaa-0000-0000-0000-000000000001')$$), 'no error', 'reactivating works while the validity covers');
select is(
  (select row(subscription_status, expires_on = pg_temp.d(10))::text
   from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '(trial,t)',
  'back to the trial, with the same dates'
);
select is(
  pg_temp.hint_of($$select public.reactivate_barbershop('aaaaaaaa-0000-0000-0000-000000000001')$$),
  'P0002', 'only a suspended barbershop is reactivated');

-- Extend the trial: only forward.
select is(
  pg_temp.hint_of($$select public.extend_trial('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.d(5))$$),
  'P0002', 'the trial is never shortened');
select is(pg_temp.hint_of($$select public.extend_trial('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.d(17))$$), 'no error', 'the trial is extended');
select is(
  (select row(trial_ends_on = pg_temp.d(17), expires_on = pg_temp.d(17))::text
   from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '(t,t)',
  'and the validity goes with it'
);

-- A suspension whose validity ran out needs a payment, which lifts it.
reset role;
select pg_temp.new_shop('aaaaaaaa-0000-0000-0000-000000000003', 'sede-vencida', -10, -40);
update public.barbershops set subscription_status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
set local role authenticated;
select is(
  pg_temp.hint_of($$select public.reactivate_barbershop('aaaaaaaa-0000-0000-0000-000000000003')$$),
  'subscription_payment_required',
  'reactivating an expired barbershop asks for a payment'
);
select pg_temp.hint_of($$select public.register_subscription_payment('aaaaaaaa-0000-0000-0000-000000000003', 'standard', 'daviplata', 'DAV-3')$$);
select is(
  (select row(subscription_status, expires_on = (pg_temp.d(0) + interval '1 month')::date - 1)::text
   from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  '(active,t)',
  'a payment lifts the suspension, counting from the payment day'
);

select * from finish();
rollback;
