-- Task 1.6: the local test data (supabase/seed.sql) is complete and valid.
-- supabase db reset loads the seed before supabase test db runs.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

-- 1. Accounts --------------------------------------------------------------------

select is(
  (select count(*) from auth.users
   where email in ('carlos@barberias.test', 'jose@barberias.test', 'admin@barberias.test')),
  3::bigint,
  'the seed creates two owners and a super admin'
);

select is(
  (select count(*) from auth.identities i
   join auth.users u on u.id = i.user_id
   where u.email like '%@barberias.test' and i.provider = 'email'),
  3::bigint,
  'every seed account can sign in with email and password'
);

select is(
  (select p.role::text from public.profiles p
   join auth.users u on u.id = p.id
   where u.email = 'admin@barberias.test'),
  'super_admin',
  'the seed super admin has the super admin role'
);

-- 2. Barbershops, created by the signup trigger -----------------------------------

select is(
  (select subscription_status::text from public.barbershops where slug = 'la-barberia-del-barrio'),
  'trial',
  'La Barbería del Barrio is on its free trial'
);

select is(
  (select subscription_status::text || ':' || plan::text from public.barbershops where slug = 'barberia-don-jose'),
  'active:basic',
  'Barbería Don José is active on the basic plan'
);

select is(
  (select count(*) from public.subscription_payments sp
   join public.barbershops b on b.id = sp.barbershop_id
   where b.slug = 'barberia-don-jose'),
  1::bigint,
  'Barbería Don José has its payment on record'
);

select is(
  (select count(*) from public.profiles p
   join public.barbershops b on b.id = p.barbershop_id
   where b.slug in ('la-barberia-del-barrio', 'barberia-don-jose') and p.role = 'owner'),
  2::bigint,
  'each seed barbershop has its owner'
);

-- 3. What each barbershop needs to take bookings -----------------------------------

select is(
  (select count(*) from public.barbers br
   join public.barbershops b on b.id = br.barbershop_id
   where b.slug in ('la-barberia-del-barrio', 'barberia-don-jose')),
  4::bigint,
  'the seed has four barbers'
);

select is(
  (select count(*) from public.services s
   join public.barbershops b on b.id = s.barbershop_id
   where b.slug in ('la-barberia-del-barrio', 'barberia-don-jose')),
  10::bigint,
  'each seed barbershop offers the five typical services'
);

select is(
  (select count(distinct bs.barber_id) from public.barber_schedules bs
   join public.barbershops b on b.id = bs.barbershop_id
   where b.slug in ('la-barberia-del-barrio', 'barberia-don-jose')),
  4::bigint,
  'every seed barber has a schedule'
);

select is(
  (select count(distinct bh.barbershop_id) from public.barbershop_hours bh
   join public.barbershops b on b.id = bh.barbershop_id
   where b.slug in ('la-barberia-del-barrio', 'barberia-don-jose')),
  2::bigint,
  'every seed barbershop has opening hours'
);

select is(
  (select link_token_hash from public.barbers where display_name = 'Andrés'),
  encode(extensions.digest('demo-barbero-andres', 'sha256'), 'hex'),
  'barber links use known local tokens, stored only as their hash'
);

-- 4. Appointments --------------------------------------------------------------------

select is(
  (select array_agg(distinct a.status::text order by a.status::text)
   from public.appointments a
   join public.barbershops b on b.id = a.barbershop_id
   where b.slug = 'la-barberia-del-barrio'),
  array['attended', 'cancelled_by_customer', 'confirmed', 'no_show'],
  'the seed covers every appointment state the agenda shows'
);

select ok(
  (select count(*) from public.appointments a
   join public.barbershops b on b.id = a.barbershop_id
   where b.slug = 'la-barberia-del-barrio'
     and a.status = 'confirmed'
     and a.starts_at > now() - interval '1 day') >= 3,
  'there are upcoming confirmed appointments after every reset'
);

select is(
  (select count(*) from public.appointments a
   join public.customers c on c.id = a.customer_id
   where c.full_name = 'Juan Gómez' and a.status = 'no_show'),
  2::bigint,
  'one customer has two no-shows, enough for the spec alert'
);

select is(
  (select array_agg(distinct a.price_cop = s.price_cop)
   from public.appointments a
   join public.services s on s.id = a.service_id
   join public.barbershops b on b.id = a.barbershop_id
   where b.slug in ('la-barberia-del-barrio', 'barberia-don-jose')),
  array[true],
  'appointments keep the price of their service'
);

select * from finish();
rollback;
