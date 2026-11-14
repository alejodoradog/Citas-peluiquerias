-- Task 5.5b, migration add_subscription_notices: the emails of the
-- subscription cycle are queued once, on their days (spec, "Ciclo de la
-- suscripción", steps 2 and 6), and a registered payment is announced.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

-- Fixtures, inserted as the table owner -------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000052a', 'dueno-52@example.com'),
  ('00000000-0000-0000-0000-0000000052ad', 'admin-52@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-00000000052a', 'Dueño Cincuenta', '+573001112233', false),
  ('00000000-0000-0000-0000-0000000052ad', 'Admin Cincuenta', null, true);

-- A barbershop whose trial ends `ends` days from today, created 30 days ago.
create function pg_temp.new_shop(n integer, ends integer)
returns uuid
language sql
as $$
  insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at)
  values (('dddddddd-0000-0000-0000-0000000005' || lpad(n::text, 2, '0'))::uuid,
          'Barbería ' || n, 'aviso-52-' || n, '+573001112233',
          private.today_bogota() + ends, private.today_bogota() + ends, now() - interval '30 days')
  returning id
$$;

-- The notices queued for a barbershop, as "type:dedupe_key".
create function pg_temp.queued(n integer)
returns text
language sql
as $$
  select coalesce(string_agg(type || ':' || dedupe_key, ',' order by dedupe_key), '')
  from public.notifications
  where barbershop_id = ('dddddddd-0000-0000-0000-0000000005' || lpad(n::text, 2, '0'))::uuid
$$;

select pg_temp.new_shop(1, 2);    -- before
select pg_temp.new_shop(2, 0);    -- due today
select pg_temp.new_shop(3, -1);   -- the day after: nothing
select pg_temp.new_shop(4, -4);   -- grace
select pg_temp.new_shop(5, -7);   -- paused (the sixth day was yesterday)
select pg_temp.new_shop(6, -30);  -- long expired: nothing
select pg_temp.new_shop(7, 10);   -- far: nothing
select pg_temp.new_shop(8, 2);    -- suspended by hand
select pg_temp.new_shop(9, 2);    -- deleted
update public.barbershops set subscription_status = 'suspended' where slug = 'aviso-52-8';
update public.barbershops set deleted_at = now() where slug = 'aviso-52-9';
-- A sede created after the trial ended: awaiting its first payment.
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at)
values ('dddddddd-0000-0000-0000-000000000510', 'Barbería 10', 'aviso-52-10', '+573001112233',
        private.today_bogota() - 4, private.today_bogota() - 4, now());
insert into public.memberships (user_id, barbershop_id, role)
select '00000000-0000-0000-0000-00000000052a', id, 'owner'
from public.barbershops where slug like 'aviso-52-%';

-- The daily job ---------------------------------------------------------------------------------

select is(private.enqueue_subscription_notices(), 4, 'four notices are due today');
select is(pg_temp.queued(1),
  'subscription_expiring:subscription:before:' || (private.today_bogota() + 2)::text,
  '3 days before: "vence el …"');
select is(pg_temp.queued(2),
  'subscription_expiring:subscription:due:' || private.today_bogota()::text,
  'on the day itself');
select is(pg_temp.queued(3), '', 'nothing the day after');
select is(pg_temp.queued(4),
  'subscription_expired:subscription:grace:' || (private.today_bogota() - 4)::text,
  'expired, in its 5 days of grace');
select is(pg_temp.queued(5),
  'subscription_suspended:subscription:paused:' || (private.today_bogota() - 7)::text,
  'paused after the grace');
select is(pg_temp.queued(6) || pg_temp.queued(7), '', 'nothing long after nor long before');
select is(pg_temp.queued(8) || pg_temp.queued(9) || pg_temp.queued(10), '',
  'nothing for a barbershop suspended by hand, deleted or awaiting its first payment');
select is(
  (select payload::text from public.notifications
   where barbershop_id = 'dddddddd-0000-0000-0000-000000000501'),
  jsonb_build_object('expires_on', private.today_bogota() + 2)::text,
  'the payload carries only the date it warns about');

select is(private.enqueue_subscription_notices(), 0, 'running again queues nothing');
select is(private.enqueue_subscription_notices(private.today_bogota() + 1), 0,
  'nor does the next day, still in the same stage');
select is(private.enqueue_subscription_notices(private.today_bogota() + 2), 3,
  'two days later: the day itself of the first, the grace of the third and the pause of the fourth');

select ok(
  (select count(*) = 1 from cron.job
   where jobname = 'subscription-notices' and schedule = '0 13 * * *'),
  'the job runs every day at 08:00 in Bogotá');

-- A registered payment ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000052ad", "role": "authenticated"}';
select public.register_subscription_payment('dddddddd-0000-0000-0000-000000000504', 'standard', 'nequi', 'NEQ-52');
reset role;

select is(
  (select count(*)::integer from public.notifications
   where barbershop_id = 'dddddddd-0000-0000-0000-000000000504'
     and type = 'subscription_payment_registered'),
  1, 'a payment queues "Recibimos tu pago"');
select is(
  (select n.payload ->> 'payment_id' from public.notifications n
   where n.barbershop_id = 'dddddddd-0000-0000-0000-000000000504'
     and n.type = 'subscription_payment_registered'),
  (select p.id::text from public.subscription_payments p
   where p.barbershop_id = 'dddddddd-0000-0000-0000-000000000504'),
  'with only the payment''s id');

-- Paying moves expires_on: a new cycle of keys, and the old notices are
-- cancelled when sent (task 5.2, outdated).
select isnt(
  (select expires_on from public.barbershops where id = 'dddddddd-0000-0000-0000-000000000504'),
  private.today_bogota() - 4,
  'the payment moved the end');
select is(
  private.enqueue_subscription_notices(
    (select expires_on - 3 from public.barbershops where id = 'dddddddd-0000-0000-0000-000000000504')
  ) >= 1,
  true,
  'and 3 days before the new end it warns again');
select is(
  (select count(*)::integer from public.notifications
   where barbershop_id = 'dddddddd-0000-0000-0000-000000000504'),
  4, 'its grace, its pause (two days ahead), the payment and the new warning, each once');

select * from finish();
rollback;
