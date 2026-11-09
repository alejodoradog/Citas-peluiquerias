-- Task 1.9, migration add_appointment_services (decision 0006): one booking can
-- carry several services. The appointment stays one block with one barber, and
-- the database keeps its length and price equal to the sum of its lines.
--
-- The line checks are deferred to commit, and every pgTAP file ends in a
-- rollback, so pg_temp.check_now runs a statement and then forces the pending
-- checks with "set constraints all immediate". Other test files insert
-- appointments without lines on purpose: those checks never fire there.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

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

select has_table('public', 'appointment_services', 'appointment_services exists');
select hasnt_column('public', 'appointments', 'service_id', 'the lines are the only source of the services');
select has_function('public', 'create_appointment', 'create_appointment exists');
select has_function('public', 'change_appointment_services', array['uuid', 'uuid[]'], 'change_appointment_services exists');

-- Fixtures, inserted as the table owner -------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com');

insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', current_date + 20),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Barbería B', 'barberia-b', current_date + 20);

insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A'),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B');

insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');

insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Hace todo', repeat('a', 64)),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Solo corte', repeat('b', 64)),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Barbero B', repeat('c', 64));

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte', 25000, 40, true),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Barba', 15000, 20, true),
  ('aaaaaaaa-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000000', 'Retirado', 10000, 20, false),
  ('aaaaaaaa-0000-0000-0000-0000000000c4', 'aaaaaaaa-0000-0000-0000-000000000000', 'Largo 1', 100000, 240, true),
  ('aaaaaaaa-0000-0000-0000-0000000000c5', 'aaaaaaaa-0000-0000-0000-000000000000', 'Largo 2', 100000, 240, true),
  ('aaaaaaaa-0000-0000-0000-0000000000c6', 'aaaaaaaa-0000-0000-0000-000000000000', 'Cejas', 8000, 10, true),
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Corte', 30000, 40, true);

insert into public.barber_services (barbershop_id, barber_id, service_id)
select 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', s.id
from public.services s where s.barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000';
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000c1'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1');

insert into public.customers (id, barbershop_id, full_name, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Cliente A', 'cliente-a@example.com'),
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Cliente B', 'cliente-b@example.com');

-- The owner of A creates appointments from the panel ------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

create temporary table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

insert into ids values ('two', public.create_appointment(
  'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
  'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '2 days 15:00',
  array['aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c2']::uuid[]
));

select lives_ok(
  $$set constraints all immediate$$,
  'an appointment with two services passes the commit checks'
);
set constraints all deferred;

select results_eq(
  $$select extract(epoch from (ends_at - starts_at))::int / 60, price_cop
    from public.appointments where id = (select id from ids where name = 'two')$$,
  $$values (60, 40000)$$,
  'two services add up to 60 minutes and 40.000 pesos'
);
select results_eq(
  $$select position::int, price_cop, duration_minutes from public.appointment_services
    where appointment_id = (select id from ids where name = 'two') order by position$$,
  $$values (1, 25000, 40), (2, 15000, 20)$$,
  'each line copies its service and keeps the order'
);

select throws_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '3 days 09:00',
      array['aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[])$$,
  '23505', null,
  'the same service cannot repeat in an appointment'
);
select throws_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '3 days 09:00', array[]::uuid[])$$,
  '23514', 'between 1 and 5 services',
  'an appointment needs at least one service'
);
select throws_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '3 days 09:00',
      array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()])$$,
  '23514', 'between 1 and 5 services',
  'an appointment has at most five services'
);
select throws_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '3 days 09:00',
      array['aaaaaaaa-0000-0000-0000-0000000000c3']::uuid[])$$,
  '23514', 'service is inactive or unknown',
  'an inactive service cannot be booked'
);
select throws_ok(
  $$select pg_temp.check_now($q$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '4 days 06:00',
      array['aaaaaaaa-0000-0000-0000-0000000000c4', 'aaaaaaaa-0000-0000-0000-0000000000c5', 'aaaaaaaa-0000-0000-0000-0000000000c6']::uuid[])$q$)$$,
  '23514', 'appointment longer than 480 minutes',
  'an appointment cannot last more than 480 minutes'
);
select throws_ok(
  $$select pg_temp.check_now($q$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b2', date_trunc('day', now()) + interval '3 days 09:00',
      array['aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c2']::uuid[])$q$)$$,
  '23514', 'the barber does not offer every service',
  'the barber must offer every service of the appointment'
);
select throws_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '3 days 09:00',
      array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[], 'web')$$,
  '42501', 'staff create manual appointments only',
  'a signed-in account cannot create a web booking'
);
select throws_ok(
  $$select pg_temp.check_now($q$insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
      values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000b1',
              date_trunc('day', now()) + interval '5 days 09:00', date_trunc('day', now()) + interval '5 days 09:40', 25000, 'manual')$q$)$$,
  '23514', 'an appointment needs at least one service',
  'an appointment inserted directly without lines fails at commit'
);
select throws_ok(
  $$select pg_temp.check_now($q$delete from public.appointment_services
      where appointment_id = (select id from ids where name = 'two') and position = 2$q$)$$,
  '23514', 'appointment length or price does not match its services',
  'removing a line by hand and leaving the totals wrong fails'
);
select throws_ok(
  $$select pg_temp.check_now($q$update public.appointments set price_cop = 1000
      where id = (select id from ids where name = 'two')$q$)$$,
  '23514', 'appointment length or price does not match its services',
  'the price cannot drift from its lines'
);

-- The no-overlap rule covers the whole block ------------------------------------------

select throws_ok(
  $$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '2 days 15:45',
      array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[])$$,
  '23P01', null,
  'a booking inside the second service of another appointment overlaps'
);
select lives_ok(
  $$select pg_temp.check_now($q$select public.create_appointment('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
      'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '2 days 16:00',
      array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[])$q$)$$,
  'a booking right where the whole block ends is fine'
);

-- Changing the services of an appointment --------------------------------------------------

insert into ids values ('one', public.create_appointment(
  'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1',
  'aaaaaaaa-0000-0000-0000-0000000000b1', date_trunc('day', now()) + interval '6 days 10:00',
  array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[]
));
set constraints all immediate;
set constraints all deferred;

select lives_ok(
  $$select pg_temp.check_now($q$select public.change_appointment_services(
      (select id from ids where name = 'one'),
      array['aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-0000000000c6']::uuid[])$q$)$$,
  'the services of a confirmed appointment can change'
);
select results_eq(
  $$select extract(epoch from (ends_at - starts_at))::int / 60, price_cop,
           (starts_at = date_trunc('day', now()) + interval '6 days 10:00')
    from public.appointments where id = (select id from ids where name = 'one')$$,
  $$values (30, 23000, true)$$,
  'the length and price follow the new services and the start is kept'
);
select results_eq(
  $$select type::text, service_id::text from public.appointment_events
    where appointment_id = (select id from ids where name = 'one')
      and type in ('service_added', 'service_removed')
    order by type::text, service_id::text$$,
  $$values ('service_added', 'aaaaaaaa-0000-0000-0000-0000000000c2'),
           ('service_added', 'aaaaaaaa-0000-0000-0000-0000000000c6'),
           ('service_removed', 'aaaaaaaa-0000-0000-0000-0000000000c1')$$,
  'the history keeps the services removed and added, not the first ones'
);

-- Rescheduling keeps the length; reassigning checks the services
select lives_ok(
  $$select pg_temp.check_now($q$update public.appointments set starts_at = starts_at + interval '2 hours'
      where id = (select id from ids where name = 'one')$q$)$$,
  'rescheduling sends only the new start'
);
select is(
  (select extract(epoch from (ends_at - starts_at))::int / 60 from public.appointments where id = (select id from ids where name = 'one')),
  30,
  'and the appointment keeps its length'
);
select throws_ok(
  $$select pg_temp.check_now($q$update public.appointments set barber_id = 'aaaaaaaa-0000-0000-0000-0000000000b2'
      where id = (select id from ids where name = 'one')$q$)$$,
  '23514', 'the barber does not offer every service',
  'reassigning to a barber who does not offer every service fails'
);

update public.appointments set status = 'cancelled_by_barbershop' where id = (select id from ids where name = 'one');

select throws_ok(
  $$select public.change_appointment_services((select id from ids where name = 'one'),
      array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[])$$,
  '23514', 'only confirmed or attended appointments',
  'the services of a cancelled appointment cannot change'
);

-- Another barbershop and the public ----------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty(
  $$select appointment_id from public.appointment_services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'owner B does not read the lines of A'
);
select throws_ok(
  $$select public.change_appointment_services((select id from ids where name = 'two'),
      array['aaaaaaaa-0000-0000-0000-0000000000c1']::uuid[])$$,
  'P0002', 'appointment not found',
  'owner B cannot change the services of an appointment of A'
);
select throws_ok(
  $$insert into public.appointment_services (barbershop_id, appointment_id, position, service_id)
    values ('aaaaaaaa-0000-0000-0000-000000000000', (select id from ids where name = 'two'), 3, 'aaaaaaaa-0000-0000-0000-0000000000c6')$$,
  '42501', null,
  'owner B cannot add a line to an appointment of A'
);

delete from public.appointment_services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000';

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select count(*)::int from public.appointment_services where appointment_id = (select id from ids where name = 'two')),
  2,
  'and owner B could not delete the lines of A'
);

set local role anon;
set local request.jwt.claims to '';

select throws_ok(
  $$select appointment_id from public.appointment_services$$,
  '42501', null,
  'anon cannot read appointment lines'
);

select * from finish();
rollback;
