-- Task 2.1, migration add_barbershop_setup: the setup wizard (D-10 to D-14)
-- saves services, the team and the default hours in one transaction.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

select has_column('public', 'barbers', 'is_owner', 'barbers marks the owner who also cuts');
select has_column('public', 'barbers', 'uses_barbershop_hours', 'barbers says whether it uses the barbershop hours');
select has_function(
  'public', 'complete_barbershop_setup', array['uuid', 'jsonb', 'jsonb', 'jsonb'],
  'complete_barbershop_setup exists'
);

-- Fixtures, inserted as the table owner -------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');

insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Sede B', 'sede-b', current_date + 10, current_date + 10),
  ('cccccccc-0000-0000-0000-000000000000', 'Sede C con horario', 'sede-c', current_date + 10, current_date + 10);

insert into public.profiles (id, full_name, phone, active, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233', true, false),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244', true, false),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', null, true, true);

insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');

-- Sede C already has hours: the wizard must not replace them.
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
  ('cccccccc-0000-0000-0000-000000000000', 1, '10:00', '18:00');

create temp table setup_input (hours jsonb, services jsonb, barbers jsonb);
grant select on setup_input to authenticated, anon;
insert into setup_input values (
  '[{"weekday": 1, "start_time": "09:00", "end_time": "20:00"},
    {"weekday": 6, "start_time": "08:00", "end_time": "21:00"}]',
  '[{"key": "s1", "name": " Corte ", "price_cop": 25000, "duration_minutes": 40},
    {"key": "s2", "name": "Barba", "price_cop": 15000, "duration_minutes": 20},
    {"key": "s3", "name": "Cejas", "price_cop": 0, "duration_minutes": 10}]',
  '[{"display_name": "Dueño A", "email": null, "is_owner": true, "service_keys": ["s1", "s2"]},
    {"display_name": " Kevin ", "email": "Kevin@Correo.com", "is_owner": false, "service_keys": ["s1", "s2", "s3"]}]'
);

-- Durations follow the spec: 5 to 240 minutes, in steps of 5 -----------------------

select throws_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Raro', 1000, 7)$$,
  '23514', null, 'a duration that is not a multiple of 5 fails'
);
select throws_ok(
  $$insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Largo', 1000, 245)$$,
  '23514', null, 'a duration over 240 minutes fails'
);

-- Other barbershops, anonymous visitors and super admins cannot run it ------------------

set local role anon;
select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours, services, barbers) from setup_input$$,
  '42501', null, 'anon cannot run the setup'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours, services, barbers) from setup_input$$,
  '42501', null, 'a super admin cannot set up a barbershop'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours, services, barbers) from setup_input$$,
  '42501', null, 'the owner of B cannot set up A'
);

-- Invalid input changes nothing ----------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours, '[]', barbers) from setup_input$$,
  '23514', null, 'at least one service is required'
);
select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours,
      '[{"key": "s1", "name": "Corte", "price_cop": 1, "duration_minutes": 40},
        {"key": "s2", "name": " corte ", "price_cop": 1, "duration_minutes": 40}]', '[]') from setup_input$$,
  '23514', null, 'two services cannot share a name, whatever the case'
);
select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours, services,
      '[{"display_name": "Kevin", "email": null, "is_owner": false, "service_keys": ["nope"]}]') from setup_input$$,
  '23514', null, 'a barber cannot do a service that is not in the setup'
);
select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours, services,
      '[{"display_name": "Kevin", "email": null, "is_owner": false, "service_keys": []}]') from setup_input$$,
  '23514', null, 'each barber does at least one service'
);
select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours, services,
      '[{"display_name": "Uno", "email": null, "is_owner": true, "service_keys": ["s1"]},
        {"display_name": "Dos", "email": null, "is_owner": true, "service_keys": ["s1"]}]') from setup_input$$,
  '23505', null, 'only one barber can be the owner'
);
select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours,
      '[{"key": "s1", "name": "Corte", "price_cop": 1, "duration_minutes": 42}]', '[]') from setup_input$$,
  '23514', null, 'a service with an invalid duration fails'
);
select is(
  (select count(*)::int from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  0, 'a failed setup leaves no services behind'
);
select is(
  (select count(*)::int from public.barbershop_hours where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  0, 'nor hours'
);

-- The owner of A sets up A -----------------------------------------------------------------

select lives_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours, services, barbers) from setup_input$$,
  'the owner sets up their barbershop'
);
select is(
  (select array_agg(name || ':' || price_cop || ':' || duration_minutes order by name)
   from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  array['Barba:15000:20', 'Cejas:0:10', 'Corte:25000:40'],
  'the services are saved trimmed, with their price and duration'
);
select is(
  (select array_agg(weekday || ' ' || start_time || '-' || end_time order by weekday)
   from public.barbershop_hours where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  array['1 09:00:00-20:00:00', '6 08:00:00-21:00:00'],
  'a barbershop without hours gets the hours of the setup'
);
select is(
  (select array_agg(display_name || ':' || coalesce(email, '-') || ':' || is_owner || ':' || sort_order || ':' || uses_barbershop_hours || ':' || link_active order by sort_order)
   from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  array['Dueño A:-:true:0:true:false', 'Kevin:kevin@correo.com:false:1:true:true'],
  'the barbers keep their order, the owner has no link and everyone uses the barbershop hours'
);
select is(
  (select count(*)::int from public.barber_services bs
     join public.barbers b on b.id = bs.barber_id
   where bs.barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000' and b.display_name = 'Kevin'),
  3, 'each barber does the services chosen for them'
);
select is(
  (select count(*)::int from public.barber_schedules where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  0, 'barbers that use the barbershop hours have no schedule of their own'
);
reset role;
select ok(
  (select bool_and(private.is_token_hash(link_token_hash)) and count(distinct link_token_hash) = 2
   from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'every barber gets its own random link hash'
);
set local role authenticated;

select throws_ok(
  $$select public.complete_barbershop_setup('aaaaaaaa-0000-0000-0000-000000000000', hours, services, barbers) from setup_input$$,
  '23514', null, 'the setup runs only once'
);
select is(
  (select count(*)::int from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  3, 'and the second try changes nothing'
);

-- Existing hours are kept; no barbers is allowed -------------------------------------

select lives_ok(
  $$select public.complete_barbershop_setup('cccccccc-0000-0000-0000-000000000000', hours, services, '[]') from setup_input$$,
  'a barbershop can finish the setup without barbers'
);
select is(
  (select array_agg(weekday || ' ' || start_time || '-' || end_time)
   from public.barbershop_hours where barbershop_id = 'cccccccc-0000-0000-0000-000000000000'),
  array['1 10:00:00-18:00:00'],
  'hours that already existed are not replaced'
);

-- Visibility of the new columns ------------------------------------------------------------

select ok(
  has_column_privilege('authenticated', 'public.barbers', 'is_owner', 'SELECT'),
  'members read which barber is the owner'
);
select ok(
  not has_column_privilege('anon', 'public.barbers', 'is_owner', 'SELECT'),
  'the public page does not'
);
select ok(
  has_column_privilege('anon', 'public.barbers', 'uses_barbershop_hours', 'SELECT'),
  'the public page reads whether a barber uses the barbershop hours'
);

select * from finish();
rollback;
