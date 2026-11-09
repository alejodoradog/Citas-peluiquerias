-- Task 1.9, migration harden_appointment_writes: fixes from the security and
-- critical reviews of the final schema (decision 0006, addendum of 1.9).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

create function pg_temp.check_now(statement text)
returns void
language plpgsql
as $$
begin
  execute statement;
  execute 'set constraints all immediate';
  execute 'set constraints all deferred';
end;
$$;
grant execute on function pg_temp.check_now(text) to authenticated;

-- Fixtures, inserted as the table owner -------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', current_date + 20),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Barbería B', 'barberia-b', current_date + 20);

insert into public.profiles (id, full_name, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', false),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', true);

-- The mistake the procedure forbids: a super admin with a membership.
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000000ad', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');

insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barbero 1', repeat('a', 64)),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barbero 2', repeat('b', 64)),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Barbero B', repeat('c', 64));

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte', 25000, 40, true),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barba', 15000, 20, true),
  ('aaaaaaaa-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000000', 'Retirado', 10000, 20, false),
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Corte', 30000, 40, true);

insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c2'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000c1'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1');

insert into public.customers (id, barbershop_id, full_name, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Con correo', 'cliente@example.com'),
  ('aaaaaaaa-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Sin correo', null),
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Cliente B', 'cliente-b@example.com');

create temporary table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- 1. A super admin never acts as a member ------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';

select throws_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'Del admin', 1000, 20)$$,
  '42501', null,
  'a super admin with a membership still cannot write tenant data'
);
select is(
  (select private.member_barbershop_ids()),
  '{}'::uuid[],
  'a super admin has no member barbershops'
);

-- 2. A session updates only the columns the panel needs ----------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

insert into ids values ('manual', public.create_appointment(
  'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d2',
  'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '2 days 09:00',
  array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[]
));
insert into ids values ('next', public.create_appointment(
  'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
  'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '2 days 09:50',
  array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[]
));
insert into ids values ('far', public.create_appointment(
  'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
  'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '3 days 09:00',
  array['aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c2']::uuid[]
));
set constraints all immediate;
set constraints all deferred;

select throws_ok(
  $$update public.appointments set source = 'web' where id = (select id from ids where name = 'manual')$$,
  '42501', null,
  'a session cannot turn a manual appointment into a web booking'
);
select throws_ok(
  $$update public.appointments set manage_token_hash = repeat('f', 64) where id = (select id from ids where name = 'manual')$$,
  '42501', null,
  'a session cannot set the manage link of an appointment'
);
select throws_ok(
  $$update public.appointments set created_at = now() - interval '1 year' where id = (select id from ids where name = 'manual')$$,
  '42501', null,
  'a session cannot rewrite when an appointment was created'
);
select throws_ok(
  $$update public.appointments set barbershop_id = 'bbbbbbbb-0000-0000-0000-000000000000' where id = (select id from ids where name = 'manual')$$,
  '42501', null,
  'a session cannot move an appointment to another barbershop'
);
select lives_ok(
  $$update public.appointments set deposit_received = true, customer_id = 'aaaaaaaa-0000-0000-0000-0000000000d1'
    where id = (select id from ids where name = 'manual')$$,
  'a session still marks the deposit and fixes the customer'
);
select throws_ok(
  $$insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000b1',
            date_trunc('day', now()) + interval '4 days 09:00', date_trunc('day', now()) + interval '4 days 09:40', 25000, 'web')$$,
  '42501', 'staff create manual appointments only',
  'a session cannot insert a web booking directly either'
);
select throws_ok(
  $$select public.create_appointment('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000d1',
      'bbbbbbbb-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '2 days 09:00',
      array['bbbbbbbb-0000-0000-0000-0000000000c1']::uuid[])$$,
  '23514', 'service is inactive or unknown',
  'an owner cannot create an appointment in another barbershop (its services are invisible to them)'
);

-- 3. The whole block never overlaps, on every path ----------------------------------------

select throws_ok(
  $$select public.change_appointment_services((select id from ids where name = 'manual'),
      array['aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c2']::uuid[])$$,
  '23P01', null,
  'adding a service that runs into the next appointment overlaps'
);
select throws_ok(
  $$update public.appointments set starts_at = date_trunc('day', now()) + interval '2 days 09:30'
    where id = (select id from ids where name = 'next')$$,
  '23P01', null,
  'rescheduling into another appointment overlaps'
);

-- 4. Changing services: order, inactive services ------------------------------------------

select lives_ok(
  $$select pg_temp.check_now($q$select public.change_appointment_services((select id from ids where name = 'far'),
      array['aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[])$q$)$$,
  'only reordering the services works'
);
select results_eq(
  $$select service_id::text from public.appointment_services
    where appointment_id = (select id from ids where name = 'far') order by position$$,
  $$values ('aaaaaaaa-0000-0000-0000-0000000000c2'), ('aaaaaaaa-0000-0000-0000-0000000000c1')$$,
  'and the new order is kept'
);
select throws_ok(
  $$select public.change_appointment_services((select id from ids where name = 'far'),
      array['aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c3']::uuid[])$$,
  '23514', 'service is inactive or unknown',
  'an inactive service cannot be added to an appointment'
);
select throws_ok(
  $$update public.appointment_services set price_cop = 1 where appointment_id = (select id from ids where name = 'far')$$,
  '42501', null,
  'a session cannot edit the price of a line'
);

reset role;
update public.services set active = false where id = 'aaaaaaaa-0000-0000-0000-0000000000c2';
set local role authenticated;

select lives_ok(
  $$select pg_temp.check_now($q$select public.change_appointment_services((select id from ids where name = 'far'),
      array['aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c2']::uuid[])$q$)$$,
  'a service deactivated after booking can stay in the appointment'
);

-- 5. Reactivating a cancelled appointment is a new occupancy -------------------------------

update public.appointments set status = 'cancelled_by_barbershop' where id = (select id from ids where name = 'next');
update public.appointments set status = 'cancelled_by_barbershop' where id = (select id from ids where name = 'manual');

reset role;
update public.barbers set active = false where id = 'aaaaaaaa-0000-0000-0000-0000000000b2';
-- Barber 1 stops offering the beard, and barber 2 leaves.
delete from public.barber_services where barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b1' and service_id = 'aaaaaaaa-0000-0000-0000-0000000000c2';
update public.barbers set active = false where id = 'aaaaaaaa-0000-0000-0000-0000000000b1';
set local role authenticated;

select throws_ok(
  $$update public.appointments set status = 'confirmed' where id = (select id from ids where name = 'next')$$,
  '23514', 'barber is inactive',
  'a cancelled appointment of an inactive barber cannot be confirmed again'
);

reset role;
update public.barbers set active = true where id = 'aaaaaaaa-0000-0000-0000-0000000000b1';
set local role authenticated;

select lives_ok(
  $$select pg_temp.check_now($q$update public.appointments set status = 'cancelled_by_barbershop'
      where id = (select id from ids where name = 'far')$q$)$$,
  'cancelling an appointment whose service the barber stopped offering still works'
);
select throws_ok(
  $$update public.appointments set status = 'confirmed' where id = (select id from ids where name = 'far')$$,
  '23514', 'the barber does not offer every service',
  'a cancelled appointment cannot come back with a service its barber no longer offers'
);
select lives_ok(
  $$update public.appointments set status = 'confirmed' where id = (select id from ids where name = 'next')$$,
  'a cancelled appointment comes back when its barber is active and offers its services'
);

-- 6. Lines are only renumbered, never edited, even by internal roles ------------------------

reset role;
set local request.jwt.claims to '';

select throws_ok(
  $$update public.appointment_services set price_cop = 1 where appointment_id = (select id from ids where name = 'next')$$,
  '23514', 'appointment lines can only be renumbered',
  'not even the table owner edits the copied price of a line'
);

-- 7. A booking made by a definer function counts as web, even with a session -------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '5 days 09:00',
      array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[], 'web')$$,
  'the public booking function can create a web booking even if the browser has a session'
);

set local role anon;
set local request.jwt.claims to '';

select throws_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '6 days 09:00',
      array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[])$$,
  '42501', null,
  'anon cannot call create_appointment'
);
select throws_ok(
  $$select public.change_appointment_services((select id from ids where name = 'next'), array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[])$$,
  '42501', null,
  'anon cannot call change_appointment_services'
);

select * from finish();
rollback;
