-- Task 5.5b, migration add_subscription_notices: an account never confirmed
-- goes 7 days after its last confirmation email, with its barbershops, if
-- they are untouched (decision S1). Anything that refers to them keeps the
-- account whole.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

-- An owner as sign-up leaves them (the trigger of register_owner_on_signup),
-- created `age` ago, confirmed or not.
create function pg_temp.sign_up(n integer, age interval, confirmed boolean)
returns uuid
language sql
as $$
  insert into auth.users (id, email, created_at, confirmation_sent_at, email_confirmed_at, raw_user_meta_data)
  values (
    ('00000000-0000-0000-0000-0000000054' || lpad(n::text, 2, '0'))::uuid,
    'dueno-54-' || n || '@example.com',
    now() - age,
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

create function pg_temp.user_of(n integer)
returns uuid
language sql
immutable
as $$
  select ('00000000-0000-0000-0000-0000000054' || lpad(n::text, 2, '0'))::uuid
$$;

create function pg_temp.account_left(n integer)
returns boolean
language sql
as $$
  select exists (select 1 from auth.users where id = pg_temp.user_of(n))
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
select pg_temp.sign_up(5, interval '8 days', false);   -- has a barber (a foreign key)
select pg_temp.sign_up(7, interval '8 days', false);   -- a super admin
select pg_temp.sign_up(8, interval '8 days', false);   -- a second sede with a queued email
select pg_temp.sign_up(9, interval '8 days', false);   -- the super admin extended its trial
select pg_temp.sign_up(10, interval '20 days', false); -- asked again for the email 2 days ago

-- The barbershops were created with their accounts, and nobody touched them
-- since (set_updated_at is off while they are dated back).
alter table public.barbershops disable trigger set_updated_at;
update public.barbershops b
set created_at = u.created_at, updated_at = u.created_at
from public.memberships m
join auth.users u on u.id = m.user_id
where m.barbershop_id = b.id and b.slug like 'limpieza-54-%';
alter table public.barbershops enable trigger set_updated_at;

insert into public.customers (barbershop_id, full_name)
values (pg_temp.shop_of(4), 'Cliente 54');
insert into public.barbers (barbershop_id, display_name, link_token_hash, sort_order)
values (pg_temp.shop_of(5), 'Barbero 54', encode(sha256('barbero-54'::bytea), 'hex'), 1);
update public.profiles set is_super_admin = true where id = pg_temp.user_of(7);
insert into public.barbershops (id, name, slug, whatsapp_phone, expires_on, created_at, updated_at)
values ('dddddddd-0000-0000-0000-000000005480', 'Sede 54-8b', 'limpieza-54-8b', '+573001112233',
        private.today_bogota(), now() - interval '8 days', now() - interval '8 days');
insert into public.memberships (user_id, barbershop_id, role)
values (pg_temp.user_of(8), 'dddddddd-0000-0000-0000-000000005480', 'owner');
select private.enqueue_notification('dddddddd-0000-0000-0000-000000005480', 'subscription_expiring', 'prueba-54');
update public.barbershops set expires_on = expires_on + 10, trial_ends_on = trial_ends_on + 10
where id = pg_temp.shop_of(9);
update auth.users set confirmation_sent_at = now() - interval '2 days' where id = pg_temp.user_of(10);
-- An account made by hand, without a barbershop.
insert into auth.users (id, email, created_at)
values ('00000000-0000-0000-0000-000000005499', 'a-mano-54@example.com', now() - interval '30 days');

select is(private.purge_unconfirmed_accounts(), 1, 'one account goes');
select is(pg_temp.account_left(1), false, 'the one never confirmed for more than 7 days');
select is(pg_temp.shop_of(1), null, 'with its barbershop, which frees its slug');
select is(
  (select count(*)::integer from public.profiles where id = pg_temp.user_of(1)),
  0, 'and its profile');

select is(pg_temp.account_left(2), true, 'not one of 6 days');
select is(pg_temp.account_left(3), true, 'nor a confirmed one');
select is(pg_temp.account_left(4), true, 'nor one whose barbershop has a customer');

select is(pg_temp.account_left(5), true, 'nor one whose barbershop has a barber');
select isnt(pg_temp.shop_of(5), null, 'its barbershop stays');
select is(
  (select count(*)::integer from public.memberships where user_id = pg_temp.user_of(5)),
  1, 'and its membership, rolled back with the rest');

select is(pg_temp.account_left(7), true, 'nor a super admin');

select is(pg_temp.account_left(8), true, 'nor one with a second sede that holds an email');
select is(
  (select count(*)::integer from public.memberships where user_id = pg_temp.user_of(8)),
  2, 'both sedes stay theirs');
select isnt(pg_temp.shop_of(8), null, 'the first one included');

select is(pg_temp.account_left(9), true, 'nor one the super admin extended');
select is(pg_temp.account_left(10), true, 'nor one that asked for the email again 2 days ago');
select is(
  (select count(*)::integer from auth.users where id = '00000000-0000-0000-0000-000000005499'),
  1, 'nor an account without a barbershop');

select is(private.purge_unconfirmed_accounts(), 0, 'running again removes nothing more');

select ok(
  (select count(*) = 1 from cron.job
   where jobname = 'purge-unconfirmed-accounts' and schedule = '45 8 * * *'),
  'the job runs every day at 03:45 in Bogotá');

select * from finish();
rollback;
