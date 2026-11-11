-- Task 1.7: an owner's inserts default to their own barbershop, so a screen
-- that forgets barbershop_id still writes to the right tenant.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com');
insert into public.barbershops (id, name, slug, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbería A', 'barberia-a', current_date + 10);
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner');

select is(
  array(
    select c.relname::text
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'barbershop_id'
      -- Written only by triggers or the platform, never by an owner's session.
      and c.relname not in ('barbershops', 'profiles', 'memberships', 'appointment_events', 'notifications', 'subscription_payments', 'barbershop_slug_changes', 'barbershop_slug_history')
      and not exists (
        select 1 from pg_attrdef d where d.adrelid = c.oid and d.adnum = a.attnum
      )
    order by 1
  ),
  '{}'::text[],
  'every table the owner writes defaults barbershop_id to the session barbershop'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$insert into public.services (name, price_cop, duration_minutes) values ('Corte', 25000, 40)$$,
  'an owner creates a service without naming the barbershop'
);
select lives_ok(
  $$insert into public.customers (full_name, phone) values ('Cliente', '+573001112233')$$,
  'an owner creates a customer without naming the barbershop'
);

reset role;
set local request.jwt.claims to '';

select is(
  (select barbershop_id::text from public.services where name = 'Corte' and price_cop = 25000
     and barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'aaaaaaaa-0000-0000-0000-000000000000',
  'the service lands in the owner barbershop'
);

select throws_ok(
  $$insert into public.services (name, price_cop, duration_minutes) values ('Sin sesión', 1000, 20)$$,
  '23502', null,
  'without a session there is no default and the insert fails'
);

select * from finish();
rollback;
