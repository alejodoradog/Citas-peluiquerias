-- Tasks 1.2 and 1.5: who can read and write what.
-- Barbershop A and B are active tenants, C belongs to a deactivated owner.
-- Fixtures are inserted as the table owner, so RLS does not apply to them.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(109);

-- Fixtures: the database may also hold the local seed, so counts below look
-- only at these rows. ----------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'owner-c@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'sin-perfil@example.com');

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Barbería B', 'barberia-b', current_date + 10),
  ('cccccccc-0000-0000-0000-000000000000', 'Barbería C', 'barberia-c', current_date + 10);

insert into public.profiles (id, full_name, active, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', true, false),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', true, false),
  ('00000000-0000-0000-0000-00000000000c', 'Dueño C', false, false),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', true, true);

insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000000', 'owner');

insert into public.barbers (id, barbershop_id, display_name, email, link_token_hash, active) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barbero A', 'barbero-a@example.com', repeat('a', 64), true),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Retirado A', null, repeat('d', 64), false),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Barbero B', 'barbero-b@example.com', repeat('b', 64), true),
  ('cccccccc-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-000000000000', 'Barbero C', null, repeat('c', 64), true);

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte', 25000, 40, true),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Retirado', 10000, 20, false),
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Corte', 30000, 40, true);

insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1');

insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 1, '09:00', '18:00'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 1, '09:00', '18:00');

insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 1, '08:00', '20:00'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 1, '08:00', '20:00');

insert into public.holiday_openings (barbershop_id, holiday_date) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '2026-12-08'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '2026-12-08');

insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 17:00Z', '2026-11-10 18:00Z', 'Cita médica'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', '2026-11-10 17:00Z', '2026-11-10 18:00Z', 'Almuerzo');

insert into public.customers (id, barbershop_id, full_name, email, phone) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Cliente A', 'cliente-a@example.com', '+573002220001'),
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Cliente B', 'cliente-b@example.com', '+573002220002');

insert into public.appointments (
  id, barbershop_id, customer_id, barber_id,
  starts_at, ends_at, price_cop, source, manage_token_hash
) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000b1', '2026-11-10 14:00Z', '2026-11-10 14:40Z', 25000, 'web', repeat('e', 64)),
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-000000000000',
   'bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-0000000000b1', '2026-11-10 14:00Z', '2026-11-10 14:40Z', 30000, 'web', repeat('f', 64));

insert into public.notifications (barbershop_id, appointment_id, type, scheduled_for, dedupe_key) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'appointment_reminder', '2026-11-09 14:00Z', 'reminder:a'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000e1', 'appointment_reminder', '2026-11-09 14:00Z', 'reminder:b');

insert into public.subscription_payments (barbershop_id, plan, amount_cop, method, reference, paid_on, covers_from, covers_until, registered_by) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'standard', 25000, 'nequi', 'REF-A', current_date + 10, current_date + 10, current_date + 40, '00000000-0000-0000-0000-0000000000ad'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'standard', 25000, 'nequi', 'REF-B', current_date + 10, current_date + 10, current_date + 40, '00000000-0000-0000-0000-0000000000ad');

-- 1. Grants that hold for every table, including future ones -------------------

select is(
  array(
    select c.relname::text || ':' || r.rolname || ':' || p.privilege
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) as r (rolname)
    cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p (privilege)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and has_table_privilege(r.rolname, c.oid, p.privilege)
    order by 1
  ),
  '{}'::text[],
  'anon and authenticated never get truncate, references or trigger'
);

select is(
  array(
    select c.relname::text || ':' || p.privilege
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as p (privilege)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      -- Column privileges exist for insert and update, not for delete.
      and case
        when p.privilege = 'DELETE' then has_table_privilege('anon', c.oid, p.privilege)
        else has_any_column_privilege('anon', c.oid, p.privilege)
      end
    order by 1
  ),
  '{}'::text[],
  'anon cannot write any table directly'
);

select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid)
    order by 1
  ),
  '{}'::text[],
  'every table in public has at least one policy'
);

select is(
  array(
    select n.nspname || '.' || p.proname || ':' || r.rolname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'), ('authenticated')) as r (rolname)
    where n.nspname in ('public', 'private')
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    order by n.nspname || '.' || p.proname || ':' || r.rolname collate "C"
  ),
  array[
    'private.check_appointment_source:authenticated',
    'private.current_barbershop_id:authenticated',
    'private.current_profile_id:authenticated',
    'private.deleted_barbershop_ids:authenticated',
    'private.has_upload_ticket:authenticated',
    'private.is_e164_phone:anon',
    'private.is_e164_phone:authenticated',
    'private.is_email:authenticated',
    'private.is_image_key:authenticated',
    'private.is_super_admin:authenticated',
    'private.is_token_hash:anon',
    'private.is_token_hash:authenticated',
    'private.member_barbershop_ids:authenticated',
    'private.set_updated_at:anon',
    'private.set_updated_at:authenticated',
    'public.change_appointment_services:authenticated',
    'public.complete_barbershop_setup:authenticated',
    'public.create_appointment:authenticated',
    'public.create_barbershop:authenticated',
    'public.delete_barbershop:authenticated',
    'public.reserve_image_upload:authenticated',
    'public.set_barber_schedule:authenticated',
    'public.set_barber_services:authenticated',
    'public.set_barbershop_hours:authenticated',
    'public.set_holiday_openings:authenticated',
    'public.set_service_barbers:authenticated'
  ],
  'anon and authenticated execute only the functions granted on purpose'
);

select ok(
  has_function_privilege('service_role', 'private.is_email(text)', 'EXECUTE'),
  'server jobs can write the columns that private.is_email checks'
);

select is(
  array(
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""'], false)
    order by 1
  ),
  '{}'::text[],
  'every security definer function pins an empty search_path'
);

-- 2. Anonymous visitor: only what booking needs --------------------------------

set local role anon;
set local request.jwt.claims to '';

select is(
  (select count(id) from public.barbershops where id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000')),
  3::bigint,
  'anon reads barbershop profiles'
);

select throws_ok(
  'select expires_on from public.barbershops',
  '42501', null,
  'anon cannot read subscription expiry'
);

select throws_ok(
  'select subscription_status from public.barbershops',
  '42501', null,
  'anon cannot read subscription status'
);

select is(
  (select count(id) from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  1::bigint,
  'anon only sees active services'
);

select is(
  (select count(id) from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  1::bigint,
  'anon only sees active barbers'
);

select throws_ok(
  'select email from public.barbers',
  '42501', null,
  'anon cannot read barber emails'
);

select throws_ok(
  'select link_token_hash from public.barbers',
  '42501', null,
  'anon cannot read barber link hashes'
);

select is(
  (select count(id) from public.time_blocks where barbershop_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000')),
  2::bigint,
  'anon reads blocked time for availability'
);

select throws_ok(
  'select reason from public.time_blocks',
  '42501', null,
  'anon cannot read why time is blocked'
);

select lives_ok('select barber_id from public.barber_services', 'anon reads which barber does which service');
select lives_ok('select weekday from public.barber_schedules', 'anon reads barber schedules');
select lives_ok('select weekday from public.barbershop_hours', 'anon reads opening hours');
select lives_ok('select holiday_date from public.holiday_openings', 'anon reads holiday openings');

select throws_ok('select id from public.customers', '42501', null, 'anon cannot read customers');
select throws_ok('select id from public.appointments', '42501', null, 'anon cannot read appointments');
select throws_ok('select id from public.notifications', '42501', null, 'anon cannot read notifications');
select throws_ok('select id from public.subscription_payments', '42501', null, 'anon cannot read payments');
select throws_ok('select id from public.profiles', '42501', null, 'anon cannot read profiles');

select throws_ok(
  $$insert into public.customers (barbershop_id, full_name, phone)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Intruso', '+573009999999')$$,
  '42501', null,
  'anon cannot create customers directly'
);

select throws_ok(
  $$update public.barbershops set name = 'Hackeada' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '42501', null,
  'anon cannot edit a barbershop'
);

reset role;

-- 3. Owner of A: sees only A ----------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  array(select id::text from public.barbershops),
  array['aaaaaaaa-0000-0000-0000-000000000000'],
  'owner A sees only barbershop A'
);

select is(
  array(select id::text from public.profiles),
  array['00000000-0000-0000-0000-00000000000a'],
  'owner A sees only their own profile'
);

select is(array(select distinct barbershop_id::text from public.barbers), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only barbers of A');
select is(array(select distinct barbershop_id::text from public.services), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only services of A');
select is(array(select distinct barbershop_id::text from public.barber_services), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only barber services of A');
select is(array(select distinct barbershop_id::text from public.barber_schedules), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only schedules of A');
select is(array(select distinct barbershop_id::text from public.barbershop_hours), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only opening hours of A');
select is(array(select distinct barbershop_id::text from public.holiday_openings), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only holiday openings of A');
select is(array(select distinct barbershop_id::text from public.time_blocks), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only blocks of A');
select is(array(select distinct barbershop_id::text from public.customers), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only customers of A');
select is(array(select distinct barbershop_id::text from public.appointments), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only appointments of A');
select is(array(select distinct barbershop_id::text from public.subscription_payments), array['aaaaaaaa-0000-0000-0000-000000000000'], 'owner A sees only payments of A');

select is_empty('select id from public.notifications', 'owners do not see the message queue');

select is(
  (select count(id) from public.barbers),
  2::bigint,
  'owner A sees inactive barbers too'
);

select is(
  (select email from public.barbers where id = 'aaaaaaaa-0000-0000-0000-0000000000b1'),
  'barbero-a@example.com',
  'owner A reads the emails of their barbers'
);

select is(
  (select email from public.customers where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'),
  'cliente-a@example.com',
  'owner A reads the emails of their customers'
);

select is(
  (select email from public.customers where id = 'bbbbbbbb-0000-0000-0000-0000000000d1'),
  null,
  'owner A cannot read the emails of customers of B'
);

select is(
  (select reason from public.time_blocks where id = 'aaaaaaaa-0000-0000-0000-0000000000f1'),
  'Cita médica',
  'owner A reads why time is blocked'
);

select throws_ok('select link_token_hash from public.barbers', '42501', null, 'owners cannot read barber link hashes');
select throws_ok('select manage_token_hash from public.appointments', '42501', null, 'owners cannot read appointment link hashes');

-- Owner A works inside A.

select lives_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Barba', 15000, 20)$$,
  'owner A creates a service in A'
);

select lives_ok(
  $$insert into public.customers (barbershop_id, full_name, phone)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Cliente nuevo', '+573003330001')$$,
  'owner A creates a customer in A'
);

select lives_ok(
  $$update public.appointments set status = 'attended' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$$,
  'owner A marks an appointment of A as attended'
);

select lives_ok(
  $$update public.barbershops set name = 'Barbería A Renovada', min_booking_notice_minutes = 30
    where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'owner A edits the configuration of A'
);

select lives_ok(
  $$update public.profiles set full_name = 'Dueño A Pérez' where id = '00000000-0000-0000-0000-00000000000a'$$,
  'owner A edits their own name'
);

-- Owner A cannot create anything in B.

select throws_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'Intruso', 1000, 20)$$,
  '42501', null, 'owner A cannot create services in B'
);
select throws_ok(
  $$insert into public.barbers (barbershop_id, display_name, link_token_hash)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'Intruso', repeat('9', 64))$$,
  '42501', null, 'owner A cannot create barbers in B'
);
select throws_ok(
  $$insert into public.customers (barbershop_id, full_name, phone)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'Intruso', '+573009999999')$$,
  '42501', null, 'owner A cannot create customers in B'
);
select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000d1',
            'bbbbbbbb-0000-0000-0000-0000000000b1',
            '2026-11-11 14:00Z', '2026-11-11 14:40Z', 30000, 'manual')$$,
  '42501', null, 'owner A cannot create appointments in B'
);
select throws_ok(
  $$insert into public.time_blocks (barbershop_id, starts_at, ends_at)
    values ('bbbbbbbb-0000-0000-0000-000000000000', '2026-11-11 14:00Z', '2026-11-11 15:00Z')$$,
  '42501', null, 'owner A cannot block time in B'
);
select throws_ok(
  $$insert into public.barber_services (barbershop_id, barber_id, service_id)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1')$$,
  '42501', null, 'owner A cannot assign services in B'
);
select throws_ok(
  $$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 2, '09:00', '18:00')$$,
  '42501', null, 'owner A cannot add schedules in B'
);
select throws_ok(
  $$insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 2, '08:00', '20:00')$$,
  '42501', null, 'owner A cannot set opening hours of B'
);
select throws_ok(
  $$insert into public.holiday_openings (barbershop_id, holiday_date)
    values ('bbbbbbbb-0000-0000-0000-000000000000', '2026-12-25')$$,
  '42501', null, 'owner A cannot open B on a holiday'
);
select throws_ok(
  $$update public.services set barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'
    where id = 'aaaaaaaa-0000-0000-0000-0000000000c2'$$,
  '42501', null, 'owner A cannot move a service of A into B'
);
select throws_ok(
  $$update public.customers set barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'
    where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'owner A cannot move a customer of A into B'
);
select throws_ok(
  $$update public.appointments set barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'
    where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$$,
  '42501', null, 'owner A cannot move an appointment of A into B'
);

-- Owner A tries to change and delete rows of B; RLS hides them, so nothing happens.

update public.barbershops set name = 'Hackeada' where id = 'bbbbbbbb-0000-0000-0000-000000000000';
update public.services set name = 'Hackeado' where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
update public.barbers set display_name = 'Hackeado' where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
update public.customers set full_name = 'Hackeado' where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
update public.appointments set status = 'cancelled_by_barbershop' where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
delete from public.barber_services where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
delete from public.time_blocks where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
delete from public.holiday_openings where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
update public.barber_schedules set start_time = '05:00' where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
update public.barbershop_hours set start_time = '05:00' where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
update public.time_blocks set reason = 'Hackeado' where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
delete from public.barber_schedules where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
delete from public.barbershop_hours where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
delete from public.customers where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
delete from public.services where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000';
-- Barbers are never deleted (task 2.2): the session has no delete at all.
select throws_ok(
  $$delete from public.barbers where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  '42501', null,
  'an owner cannot delete barbers, not even of another barbershop'
);

-- Owner A tries to give themselves more power.

select throws_ok(
  $$update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'an owner cannot make themselves super admin'
);
select throws_ok(
  $$insert into public.memberships (user_id, barbershop_id, role) values ('00000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner')$$,
  '42501', null, 'an owner cannot join another barbershop'
);
select throws_ok(
  $$update public.profiles set active = true where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'an owner cannot change whether their account is active'
);
select throws_ok(
  $$update public.barbershops set expires_on = '2030-01-01' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '42501', null, 'an owner cannot extend their subscription'
);
select throws_ok(
  $$update public.barbershops set subscription_status = 'active', plan = 'standard' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '42501', null, 'an owner cannot activate their subscription'
);
select throws_ok(
  $$insert into public.subscription_payments (barbershop_id, plan, amount_cop, method, reference, paid_on, covers_from, covers_until, registered_by)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'standard', 25000, 'nequi', 'FALSO', current_date + 10, current_date + 10, current_date + 375, '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'an owner cannot register their own payment'
);
select throws_ok(
  $$insert into public.notifications (barbershop_id, type, scheduled_for, dedupe_key)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'appointment_reminder', '2026-11-09 14:00Z', 'spam')$$,
  '42501', null, 'an owner cannot queue messages directly'
);
select throws_ok(
  $$insert into public.barbershops (name, slug, expires_on) values ('Otra', 'otra-mia', '2030-01-01')$$,
  '42501', null, 'an owner cannot create barbershops directly'
);
select throws_ok(
  $$delete from public.appointments where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$$,
  '42501', null, 'appointments are history and are never deleted'
);

reset role;

select is((select name from public.barbershops where id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'Barbería B', 'owner A did not rename B');
select is((select count(*) from public.services where name = 'Hackeado'), 0::bigint, 'owner A did not change services of B');
select is((select count(*) from public.barbers where display_name = 'Hackeado'), 0::bigint, 'owner A did not change barbers of B');
select is((select count(*) from public.customers where full_name = 'Hackeado'), 0::bigint, 'owner A did not change customers of B');
select is((select status::text from public.appointments where id = 'bbbbbbbb-0000-0000-0000-0000000000e1'), 'confirmed', 'owner A did not cancel appointments of B');
select is((select count(*) from public.barber_services where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 1::bigint, 'owner A did not delete barber services of B');
select is((select count(*) from public.time_blocks where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 1::bigint, 'owner A did not delete blocks of B');
select is((select count(*) from public.holiday_openings where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 1::bigint, 'owner A did not delete holiday openings of B');
select is((select start_time::text from public.barber_schedules where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), '09:00:00', 'owner A did not change or delete schedules of B');
select is((select start_time::text from public.barbershop_hours where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), '08:00:00', 'owner A did not change or delete opening hours of B');
select is((select reason from public.time_blocks where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'Almuerzo', 'owner A did not change blocks of B');
select is((select count(*) from public.customers where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 1::bigint, 'owner A did not delete customers of B');
select is((select count(*) from public.services where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 1::bigint, 'owner A did not delete services of B');
select is((select count(*) from public.barbers where barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 1::bigint, 'owner A did not delete barbers of B');

-- 4. Deactivated owner: sees nothing, not even their profile ---------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is_empty('select id from public.barbershops', 'a deactivated owner sees no barbershop');
select is_empty('select id from public.barbers', 'a deactivated owner sees no barbers');
select is_empty('select id from public.profiles', 'a deactivated owner does not see their own profile');

select lives_ok(
  $$update public.barbershops set name = 'Sigo aquí' where id = 'cccccccc-0000-0000-0000-000000000000'$$,
  'a deactivated owner update runs'
);

reset role;

select is((select name from public.barbershops where id = 'cccccccc-0000-0000-0000-000000000000'), 'Barbería C', 'but changes nothing');

-- 5. Signed-in user without a profile: sees and writes nothing --------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';

select is_empty('select id from public.barbershops', 'a user without profile sees no barbershop');
select is_empty('select id from public.customers', 'a user without profile sees no customers');
select throws_ok(
  $$insert into public.customers (barbershop_id, full_name, phone)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Intruso', '+573009999999')$$,
  '42501', null, 'a user without profile cannot create customers'
);

reset role;

-- 6. Super admin: reads everything, writes through functions only (task 5.4) ------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';

select is((select count(id) from public.barbershops where id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000')), 3::bigint, 'super admin sees every barbershop');
select is((select count(id) from public.profiles where id in (
  '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000ad')), 4::bigint, 'super admin sees every profile');
-- A and B, plus the customer owner A created above.
select is((select count(id) from public.customers where barbershop_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000')), 3::bigint, 'super admin sees every customer');
select is((select count(id) from public.notifications where barbershop_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000')), 2::bigint, 'super admin sees the message queue');
select is((select count(id) from public.subscription_payments where barbershop_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000')), 2::bigint, 'super admin sees every payment');

select throws_ok(
  'select link_token_hash from public.barbers',
  '42501', null,
  'not even the super admin reads barber link hashes'
);
select throws_ok(
  'select manage_token_hash from public.appointments',
  '42501', null,
  'not even the super admin reads appointment link hashes'
);
select throws_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Del admin', 1000, 20)$$,
  '42501', null,
  'the super admin does not create tenant data'
);
select throws_ok(
  $$update public.profiles set active = false where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'the super admin does not deactivate accounts directly'
);

select throws_ok(
  $$update public.barbershops set expires_on = '2030-01-01' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '42501', null,
  'subscriptions change only through the payment function'
);

select lives_ok(
  $$update public.customers set full_name = 'Admin estuvo aquí' where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'a super admin update on tenant data runs'
);
select throws_ok(
  $$delete from public.barbers where id = 'aaaaaaaa-0000-0000-0000-0000000000b2'$$,
  '42501', null,
  'a super admin cannot delete barbers either'
);

reset role;

select is(
  (select count(*) from public.customers where full_name = 'Admin estuvo aquí'),
  0::bigint,
  'but the super admin does not edit tenant data'
);
select is(
  (select count(*) from public.barbers where id = 'aaaaaaaa-0000-0000-0000-0000000000b2'),
  1::bigint,
  'and does not delete tenant data'
);

select * from finish();
rollback;
