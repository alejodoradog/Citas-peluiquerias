-- Task 1.1: data model. Structure, tenant isolation guards and integrity rules.
-- Fixtures are inserted as the table owner, so RLS does not apply to them.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(63);

-- 1. Tables ------------------------------------------------------------------

select has_table('public', 'barbershops', 'barbershops exists');
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'barbers', 'barbers exists');
select has_table('public', 'barber_schedules', 'barber_schedules exists');
select has_table('public', 'barbershop_hours', 'barbershop_hours exists');
select has_table('public', 'holiday_openings', 'holiday_openings exists');
select has_table('public', 'services', 'services exists');
select has_table('public', 'barber_services', 'barber_services exists');
select has_table('public', 'time_blocks', 'time_blocks exists');
select has_table('public', 'customers', 'customers exists');
select has_table('public', 'appointments', 'appointments exists');
select has_table('public', 'notifications', 'notifications exists');
select has_table('public', 'subscription_payments', 'subscription_payments exists');

-- 2. Rules that hold for every table, including future ones -------------------

select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
    order by 1
  ),
  '{}'::text[],
  'every table in public has row level security enabled'
);

-- barbershops is the tenant root; profiles allows null only for super admins.
select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname not in ('barbershops', 'profiles')
      and not exists (
        select 1
        from pg_attribute a
        where a.attrelid = c.oid
          and a.attname = 'barbershop_id'
          and a.attnotnull
          and not a.attisdropped
      )
    order by 1
  ),
  '{}'::text[],
  'every business table has a not null barbershop_id'
);

-- 3. Fixtures: barbershop A and barbershop B ----------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'second-a@example.com');

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', '2026-11-18'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Barbería B', 'barberia-b', '2026-11-18');

insert into public.profiles (id, barbershop_id, role, full_name) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner', 'Dueño A'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner', 'Dueño B'),
  ('00000000-0000-0000-0000-0000000000ad', null, 'super_admin', 'Admin');

insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barbero A', repeat('a', 64)),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Barbero B', repeat('b', 64));

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte', 25000, 40),
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Corte', 30000, 40);

insert into public.customers (id, barbershop_id, full_name, phone) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Cliente A', '+573001112233'),
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Cliente B', '+573001112233');

insert into public.appointments (
  id, barbershop_id, customer_id, barber_id, service_id,
  starts_at, ends_at, price_cop, source
) values (
  'aaaaaaaa-0000-0000-0000-0000000000e1',
  'aaaaaaaa-0000-0000-0000-000000000000',
  'aaaaaaaa-0000-0000-0000-0000000000d1',
  'aaaaaaaa-0000-0000-0000-0000000000b1',
  'aaaaaaaa-0000-0000-0000-0000000000c1',
  '2026-11-10 14:00Z', '2026-11-10 14:40Z', 25000, 'web'
);

-- 4. Nothing from barbershop A may point at barbershop B -----------------------

select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
            'bbbbbbbb-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1',
            '2026-11-10 15:00Z', '2026-11-10 15:40Z', 25000, 'web')$$,
  '23503', null,
  'an appointment cannot use a barber from another barbershop'
);

select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000d1',
            'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1',
            '2026-11-10 15:00Z', '2026-11-10 15:40Z', 25000, 'web')$$,
  '23503', null,
  'an appointment cannot use a customer from another barbershop'
);

select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
            'aaaaaaaa-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1',
            '2026-11-10 15:00Z', '2026-11-10 15:40Z', 25000, 'web')$$,
  '23503', null,
  'an appointment cannot use a service from another barbershop'
);

select throws_ok(
  $$insert into public.barber_services (barbershop_id, barber_id, service_id)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1',
            'bbbbbbbb-0000-0000-0000-0000000000c1')$$,
  '23503', null,
  'a barber cannot offer a service from another barbershop'
);

select throws_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 1, '09:00', '18:00')$$,
  '23503', null,
  'a schedule cannot belong to a barber from another barbershop'
);

select throws_ok(
  $$insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1',
            '2026-11-10 17:00Z', '2026-11-10 18:00Z')$$,
  '23503', null,
  'a block cannot target a barber from another barbershop'
);

select throws_ok(
  $$insert into public.notifications (barbershop_id, appointment_id, type, channel, scheduled_for, dedupe_key)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1',
            'appointment_reminder', 'whatsapp', '2026-11-09 14:00Z', 'cross-tenant')$$,
  '23503', null,
  'a notification cannot point at an appointment from another barbershop'
);

-- 5. Barbershops ----------------------------------------------------------------

select throws_ok(
  $$insert into public.barbershops (name, slug, expires_on) values ('Otra', 'barberia-a', '2026-11-18')$$,
  '23505', null,
  'slugs are unique'
);

select throws_ok(
  $$insert into public.barbershops (name, slug, expires_on) values ('Otra', 'Barberia Con Espacios', '2026-11-18')$$,
  '23514', null,
  'slugs only allow lowercase letters, digits and single hyphens'
);

select throws_ok(
  $$insert into public.barbershops (name, slug, expires_on, subscription_status) values ('Otra', 'otra', '2026-11-18', 'active')$$,
  '23514', null,
  'an active subscription needs a plan'
);

select lives_ok(
  $$insert into public.barbershops (name, slug, expires_on, subscription_status, plan) values ('Activa', 'activa', '2026-12-18', 'active', 'basic')$$,
  'an active subscription with a plan is accepted'
);

select is(
  (select plan::text from public.barbershops where slug = 'barberia-a'),
  null,
  'a new barbershop starts its trial without a plan'
);

select is(
  (select subscription_status::text from public.barbershops where slug = 'barberia-a'),
  'trial',
  'a new barbershop starts in trial'
);

select is(
  (select min_booking_notice_minutes from public.barbershops where slug = 'barberia-a'),
  60,
  'minimum booking notice defaults to one hour'
);

select is(
  (select cancellation_notice_hours from public.barbershops where slug = 'barberia-a'),
  2,
  'cancellation notice defaults to two hours'
);

select throws_ok(
  $$update public.barbershops set latitude = 4.6 where slug = 'barberia-a'$$,
  '23514', null,
  'latitude and longitude go together'
);

select throws_ok(
  $$update public.barbershops set deposit_method = 'nequi' where slug = 'barberia-a'$$,
  '23514', null,
  'a deposit method needs its account'
);

select throws_ok(
  $$update public.barbershops set deposit_method = 'bank_transfer', deposit_account = '123' where slug = 'barberia-a'$$,
  '23514', null,
  'deposits do not go to a bank account'
);

select throws_ok(
  $$update public.barbershops set whatsapp_phone = '3001112233' where slug = 'barberia-a'$$,
  '23514', null,
  'phones are stored in E.164 format'
);

-- 6. Profiles -------------------------------------------------------------------

select throws_ok(
  $$insert into public.profiles (id, barbershop_id, role, full_name)
    values ('00000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner', 'Otro dueño')$$,
  '23505', null,
  'a barbershop has only one owner account'
);

select throws_ok(
  $$insert into public.profiles (id, barbershop_id, role, full_name)
    values ('00000000-0000-0000-0000-0000000000a2', null, 'owner', 'Sin barbería')$$,
  '23514', null,
  'an owner must belong to a barbershop'
);

select throws_ok(
  $$insert into public.profiles (id, barbershop_id, role, full_name)
    values ('00000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'super_admin', 'Admin con barbería')$$,
  '23514', null,
  'a super admin does not belong to a barbershop'
);

select throws_ok(
  $$insert into public.profiles (id, role, full_name)
    values ('00000000-0000-0000-0000-0000000000ff', 'super_admin', 'Sin usuario')$$,
  '23503', null,
  'a profile needs an auth user'
);

-- 7. Barbers, services and schedules --------------------------------------------

select throws_ok(
  $$insert into public.barbers (barbershop_id, display_name, link_token_hash)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Sin hash', 'token-en-claro')$$,
  '23514', null,
  'barber links are stored only as a SHA-256 hex hash'
);

select throws_ok(
  $$insert into public.barbers (barbershop_id, display_name, link_token_hash)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Repetido', repeat('a', 64))$$,
  '23505', null,
  'barber link hashes are unique'
);

select throws_ok(
  $$insert into public.barbers (barbershop_id, display_name, link_token_hash, whatsapp_notifications)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Sin celular', repeat('c', 64), true)$$,
  '23514', null,
  'WhatsApp notices to a barber need the barber phone'
);

select throws_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Negativo', -1, 30)$$,
  '23514', null,
  'prices cannot be negative'
);

select throws_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Sin duración', 10000, 0)$$,
  '23514', null,
  'services last more than zero minutes'
);

select col_type_is('public', 'services', 'price_cop', 'integer', 'prices are whole pesos');

select lives_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 1, '09:00', '12:00'),
      ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 1, '14:00', '19:00')$$,
  'a barber can work a split shift'
);

select throws_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 7, '09:00', '18:00')$$,
  '23514', null,
  'weekdays go from 0 (Sunday) to 6 (Saturday)'
);

select throws_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 1, '18:00', '09:00')$$,
  '23514', null,
  'opening hours end after they start'
);

select lives_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
      ('aaaaaaaa-0000-0000-0000-000000000000', 6, '08:00', '12:00'),
      ('aaaaaaaa-0000-0000-0000-000000000000', 6, '14:00', '20:00')$$,
  'a barbershop can open a split shift'
);

select lives_ok(
  $$insert into public.holiday_openings (barbershop_id, holiday_date)
    values ('aaaaaaaa-0000-0000-0000-000000000000', '2026-12-08')$$,
  'a barbershop can choose to open on a holiday'
);

select throws_ok(
  $$insert into public.holiday_openings (barbershop_id, holiday_date)
    values ('aaaaaaaa-0000-0000-0000-000000000000', '2026-12-08')$$,
  '23505', null,
  'a holiday opening is recorded once'
);

-- 8. Blocks, customers and appointments -----------------------------------------

select lives_ok(
  $$insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
    values ('aaaaaaaa-0000-0000-0000-000000000000', null, '2026-12-24 22:00Z', '2026-12-25 23:00Z', 'Cierre especial')$$,
  'a block without barber closes the whole barbershop'
);

select throws_ok(
  $$insert into public.time_blocks (barbershop_id, starts_at, ends_at)
    values ('aaaaaaaa-0000-0000-0000-000000000000', '2026-11-10 18:00Z', '2026-11-10 17:00Z')$$,
  '23514', null,
  'a block ends after it starts'
);

select throws_ok(
  $$insert into public.customers (barbershop_id, full_name, phone)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Mismo celular', '+573001112233')$$,
  '23505', null,
  'a phone is unique within a barbershop'
);

select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
            'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1',
            '2026-11-10 15:00Z', '2026-11-10 15:00Z', 25000, 'web')$$,
  '23514', null,
  'an appointment ends after it starts'
);

select is(
  (select status::text from public.appointments where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'),
  'confirmed',
  'a new appointment starts confirmed'
);

select col_type_is('public', 'appointments', 'starts_at', 'timestamp with time zone', 'appointments are stored as instants');

select throws_ok(
  $$delete from public.customers where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'$$,
  '23503', null,
  'a customer with appointments is not deleted'
);

-- 9. Notifications and subscription payments ------------------------------------

select lives_ok(
  $$insert into public.notifications (barbershop_id, appointment_id, type, channel, scheduled_for, dedupe_key)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1',
            'appointment_reminder', 'whatsapp', '2026-11-09 14:00Z', 'reminder:e1')$$,
  'a reminder is queued'
);

select throws_ok(
  $$insert into public.notifications (barbershop_id, appointment_id, type, channel, scheduled_for, dedupe_key)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1',
            'appointment_reminder', 'whatsapp', '2026-11-09 14:00Z', 'reminder:e1')$$,
  '23505', null,
  'the same message is never queued twice'
);

select lives_ok(
  $$insert into public.notifications (barbershop_id, type, channel, scheduled_for, dedupe_key)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'subscription_expiring', 'email', '2026-11-15 13:00Z', 'reminder:e1')$$,
  'dedupe keys are scoped to each barbershop'
);

select throws_ok(
  $$update public.notifications set status = 'sent' where dedupe_key = 'reminder:e1'$$,
  '23514', null,
  'a sent notification records when it was sent'
);

select throws_ok(
  $$insert into public.subscription_payments (barbershop_id, plan, billing_period, amount_cop, method, reference, paid_on, covers_from, covers_until, registered_by)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'basic', 'monthly', 39900, 'nequi', 'REF-1',
            '2026-11-18', '2026-12-18', '2026-11-18', '00000000-0000-0000-0000-0000000000ad')$$,
  '23514', null,
  'a payment covers a forward period'
);

select lives_ok(
  $$insert into public.subscription_payments (barbershop_id, plan, billing_period, amount_cop, method, reference, paid_on, covers_from, covers_until, registered_by)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'basic', 'monthly', 39900, 'nequi', 'REF-1',
            '2026-11-18', '2026-11-18', '2026-12-18', '00000000-0000-0000-0000-0000000000ad')$$,
  'a valid payment is recorded'
);

-- Access by role is tested in 02_rls.test.sql.

select * from finish();
rollback;
