-- Task 4.6, migration add_day_close: the barbers' commission of each
-- barbershop, which the owner sets on "Cierre del día" (D-64).
--
-- - It starts at 0 and stays between 0 and 100.
-- - The owner changes it in their own barbershops, never in another one.
-- - anon neither reads nor changes it.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select has_column('public', 'barbershops', 'commission_percent', 'barbershops has commission_percent');
select col_default_is('public', 'barbershops', 'commission_percent', '0', 'it starts at 0');
select ok(
  has_column_privilege('authenticated', 'public.barbershops', 'commission_percent', 'UPDATE')
    and not has_column_privilege('anon', 'public.barbershops', 'commission_percent', 'SELECT')
    and not has_column_privilege('anon', 'public.barbershops', 'commission_percent', 'UPDATE'),
  'sessions update it; anon neither reads nor changes it'
);

-- Fixtures, inserted as the table owner -------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dueno-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'dueno-b@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233', false),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244', false);
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sede A', 'sede-a-cierre', '+573001112233', current_date + 10, current_date + 10, now() - interval '3 days'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Sede B', 'sede-b-cierre', '+573001112244', current_date + 10, current_date + 10, now() - interval '3 days');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner');

-- The hint of the error a statement raises (or its SQLSTATE), or 'no error'.
create function pg_temp.state_of(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return 'no error';
exception when others then
  return sqlstate;
end;
$$;
grant execute on function pg_temp.state_of(text) to authenticated;

-- The owner of A ----------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  pg_temp.state_of($$update public.barbershops set commission_percent = 40 where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$),
  'no error',
  'the owner of A sets the commission of A'
);
select is(
  (select commission_percent from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  40::smallint,
  'and it is saved'
);
select is(
  pg_temp.state_of($$update public.barbershops set commission_percent = 101 where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$),
  '23514',
  'never above 100'
);
select is(
  pg_temp.state_of($$update public.barbershops set commission_percent = -5 where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$),
  '23514',
  'nor below 0'
);

-- An update of B touches nothing: the policy hides B from A.
update public.barbershops set commission_percent = 90 where id = 'bbbbbbbb-0000-0000-0000-000000000001';
reset role;
select is(
  (select commission_percent from public.barbershops where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  0::smallint,
  'the owner of A never changes the commission of B'
);

select * from finish();
rollback;
