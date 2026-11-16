-- Task 7.3, migration require_location_for_setup: an establishment is not
-- set up without its location, and a set up one does not lose it.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

create function pg_temp.hint_of(statement text)
returns text
language plpgsql
as $$
declare
  hint text;
begin
  execute statement;
  return 'no error';
exception when others then
  get stacked diagnostics hint = pg_exception_hint;
  return coalesce(hint, 'no hint');
end;
$$;

insert into public.barbershops (id, name, slug, expires_on) values
  ('00000000-0000-0000-0000-0000000066a1', 'Sin punto', 'ubicacion-66-sin', current_date + 10),
  ('00000000-0000-0000-0000-0000000066a2', 'Con punto', 'ubicacion-66-con', current_date + 10);
-- One from before the rule: set up, and without a point.
insert into public.barbershops (id, name, slug, expires_on, setup_completed_at) values
  ('00000000-0000-0000-0000-0000000066a3', 'De antes', 'ubicacion-66-antes', current_date + 10, now());

select is(
  pg_temp.hint_of($$update public.barbershops set setup_completed_at = now()
    where id = '00000000-0000-0000-0000-0000000066a1'$$),
  'location_required',
  'the wizard does not finish without the location'
);
select is(
  (select setup_completed_at from public.barbershops where id = '00000000-0000-0000-0000-0000000066a1'),
  null,
  'and the barbershop stays as it was'
);

update public.barbershops set latitude = 3.4516, longitude = -76.532
where id = '00000000-0000-0000-0000-0000000066a2';
select is(
  pg_temp.hint_of($$update public.barbershops set setup_completed_at = now()
    where id = '00000000-0000-0000-0000-0000000066a2'$$),
  'no error',
  'with the location, it finishes'
);
select is(
  pg_temp.hint_of($$update public.barbershops set latitude = null, longitude = null
    where id = '00000000-0000-0000-0000-0000000066a2'$$),
  'location_required',
  'a set up barbershop does not lose its location'
);
select is(
  pg_temp.hint_of($$update public.barbershops set latitude = 3.45, longitude = -76.53
    where id = '00000000-0000-0000-0000-0000000066a2'$$),
  'no error',
  'but it can mark it again'
);

-- The one from before the rule.
select is(
  pg_temp.hint_of($$update public.barbershops set name = 'De antes, con otro nombre'
    where id = '00000000-0000-0000-0000-0000000066a3'$$),
  'no error',
  'a barbershop set up before the rule keeps working without a point'
);
select is(
  pg_temp.hint_of($$update public.barbershops set latitude = 3.4516, longitude = -76.532
    where id = '00000000-0000-0000-0000-0000000066a3'$$),
  'no error',
  'it can mark its point'
);
select is(
  pg_temp.hint_of($$update public.barbershops set latitude = null, longitude = null
    where id = '00000000-0000-0000-0000-0000000066a3'$$),
  'location_required',
  'and from then on it does not lose it either'
);

-- As an owner does it, by the wizard and by hand -------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000066d1', 'duena-66@example.com'),
  ('00000000-0000-0000-0000-0000000066d2', 'otro-66@example.com');
insert into public.profiles (id, full_name, phone, active, is_super_admin) values
  ('00000000-0000-0000-0000-0000000066d1', 'Dueña 66', '+573001230661', true, false),
  ('00000000-0000-0000-0000-0000000066d2', 'Otro 66', '+573001230662', true, false);
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('00000000-0000-0000-0000-0000000066b1', 'De la dueña', 'ubicacion-66-duena', current_date + 10, current_date + 10),
  ('00000000-0000-0000-0000-0000000066b2', 'Del otro', 'ubicacion-66-otro', current_date + 10, current_date + 10);
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-0000000066d1', '00000000-0000-0000-0000-0000000066b1', 'owner'),
  ('00000000-0000-0000-0000-0000000066d2', '00000000-0000-0000-0000-0000000066b2', 'owner');
grant execute on function pg_temp.hint_of(text) to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000066d1", "role": "authenticated"}';
select is(
  pg_temp.hint_of($$select public.complete_barbershop_setup(
    '00000000-0000-0000-0000-0000000066b1',
    '[{"weekday": 1, "start_time": "09:00", "end_time": "19:00"}]',
    '[{"key": "s1", "name": "Consulta", "price_cop": 80000, "duration_minutes": 30}]',
    '[{"display_name": "Dueña 66", "email": null, "is_owner": true, "service_keys": ["s1"]}]')$$),
  'location_required',
  'the wizard of an owner does not finish without the location'
);
select is(
  (select count(*)::int from public.services where barbershop_id = '00000000-0000-0000-0000-0000000066b1'),
  0,
  'and nothing of it is kept: no service was created'
);
select is(
  pg_temp.hint_of($$update public.barbershops set setup_completed_at = now()
    where id = '00000000-0000-0000-0000-0000000066b1'$$),
  'location_required',
  'nor by writing the mark by hand'
);
-- The point of another owner's barbershop is out of reach: no row changes.
update public.barbershops set latitude = 1, longitude = 1
where id = '00000000-0000-0000-0000-0000000066b2';
reset role;
select is(
  (select latitude from public.barbershops where id = '00000000-0000-0000-0000-0000000066b2'),
  null,
  'an owner does not mark the location of someone else''s barbershop'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000066d1", "role": "authenticated"}';
update public.barbershops set latitude = 3.4516, longitude = -76.532
where id = '00000000-0000-0000-0000-0000000066b1';
select is(
  pg_temp.hint_of($$select public.complete_barbershop_setup(
    '00000000-0000-0000-0000-0000000066b1',
    '[{"weekday": 1, "start_time": "09:00", "end_time": "19:00"}]',
    '[{"key": "s1", "name": "Consulta", "price_cop": 80000, "duration_minutes": 30}]',
    '[{"display_name": "Dueña 66", "email": null, "is_owner": true, "service_keys": ["s1"]}]')$$),
  'no error',
  'with their point marked, the wizard finishes'
);
reset role;

select * from finish();
rollback;
