-- Task 7.3, migration require_location_for_setup: an establishment is not
-- set up without its location, and a set up one does not lose it.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

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

select * from finish();
rollback;
