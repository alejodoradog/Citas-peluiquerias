-- Task 5.5b, migration add_subscription_notices: an account never confirmed
-- goes after 7 days with its barbershop, if that barbershop is empty
-- (decision S1).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

-- An owner as sign-up leaves them (the trigger of register_owner_on_signup),
-- created `age` ago, confirmed or not.
create function pg_temp.sign_up(n integer, age interval, confirmed boolean)
returns uuid
language sql
as $$
  insert into auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data)
  values (
    ('00000000-0000-0000-0000-0000000054' || lpad(n::text, 2, '0'))::uuid,
    'dueno-54-' || n || '@example.com',
    now() - age,
    case when confirmed then now() - age end,
    jsonb_build_object(
      'barbershop_name', 'Barbería 54-' || n,
      'barbershop_slug', 'limpieza-54-' || n,
      'owner_name', 'Dueño ' || n,
      'phone', '+573001112233'
    )
  )
  returning id
$$;

create function pg_temp.account_left(n integer)
returns boolean
language sql
as $$
  select exists (
    select 1 from auth.users
    where id = ('00000000-0000-0000-0000-0000000054' || lpad(n::text, 2, '0'))::uuid
  )
$$;

create function pg_temp.shop_of(n integer)
returns uuid
language sql
as $$
  select id from public.barbershops where slug = 'limpieza-54-' || n
$$;

select pg_temp.sign_up(1, interval '8 days', false);   -- goes
select pg_temp.sign_up(2, interval '6 days', false);   -- too young
select pg_temp.sign_up(3, interval '30 days', true);   -- confirmed
select pg_temp.sign_up(4, interval '8 days', false);   -- has a customer
insert into public.customers (barbershop_id, full_name)
values (pg_temp.shop_of(4), 'Cliente 54');
-- An account made by hand, without a barbershop.
insert into auth.users (id, email, created_at)
values ('00000000-0000-0000-0000-000000005499', 'a-mano-54@example.com', now() - interval '30 days');

select is(private.purge_unconfirmed_accounts(), 1, 'one account goes');
select is(pg_temp.account_left(1), false, 'the one never confirmed for more than 7 days');
select is(pg_temp.shop_of(1), null, 'with its barbershop, which frees its slug');
select is(
  (select count(*)::integer from public.profiles
   where id = '00000000-0000-0000-0000-000000005401'),
  0, 'and its profile');
select is(pg_temp.account_left(2), true, 'not one of 6 days');
select is(pg_temp.account_left(3), true, 'nor a confirmed one');
select is(pg_temp.account_left(4), true, 'nor one whose barbershop holds data');
select is(
  (select count(*)::integer from auth.users where id = '00000000-0000-0000-0000-000000005499'),
  1, 'nor an account without a barbershop');

select ok(
  (select count(*) = 1 from cron.job
   where jobname = 'purge-unconfirmed-accounts' and schedule = '45 8 * * *'),
  'the job runs every day at 03:45 in Bogotá');

select * from finish();
rollback;
