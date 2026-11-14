-- Task 6.5, migration add_legal_acceptance: the proof of the authorization
-- (Ley 1581, article 9): when and which version.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

select ok(
  has_function_privilege('service_role', 'public.record_privacy_acceptance(uuid, uuid, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.record_privacy_acceptance(uuid, uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.record_privacy_acceptance(uuid, uuid, text)', 'EXECUTE'),
  'only the app''s server keeps a customer''s acceptance'
);

-- Sign-up with the version, and without it (an account made by hand).
insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-0000000063a1', 'acepta@example.com',
  '{"owner_name": "Ana Acepta", "barbershop_name": "Barbería Acepta",
    "barbershop_slug": "barberia-acepta", "phone": "+573001230001", "terms_version": "2026-11-14"}'
), (
  '00000000-0000-0000-0000-0000000063a2', 'sin-version@example.com',
  '{"owner_name": "Sin Version", "barbershop_name": "Barbería Sin",
    "barbershop_slug": "barberia-sin-version", "phone": "+573001230002"}'
);
select is(
  (select row(terms_version, terms_accepted_at is not null)::text from public.profiles
   where id = '00000000-0000-0000-0000-0000000063a1'),
  '(2026-11-14,t)', 'the owner''s profile keeps the version they accepted at sign-up, and when'
);
select is(
  (select row(terms_version, terms_accepted_at)::text from public.profiles
   where id = '00000000-0000-0000-0000-0000000063a2'),
  '(,)', 'an account without it keeps nothing'
);

-- A booking's acceptance.
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active)
select '5e000000-0000-0000-0000-000000000063', b.id, 'Corte', 25000, 30, true
from public.barbershops b where b.slug = 'barberia-acepta';
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order)
select 'ba000000-0000-0000-0000-000000000063', b.id, 'Uno',
       encode(sha256(convert_to('Uno legal', 'UTF8')), 'hex'), 1
from public.barbershops b where b.slug = 'barberia-acepta';
insert into public.customers (id, barbershop_id, full_name, email)
select 'c0000000-0000-0000-0000-000000000063', b.id, 'Camila', 'camila@example.com'
from public.barbershops b where b.slug = 'barberia-acepta';
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
select 'e0000000-0000-0000-0000-000000000063', b.id, 'c0000000-0000-0000-0000-000000000063',
       'ba000000-0000-0000-0000-000000000063', now() + interval '2 days', now() + interval '2 days 30 minutes', 25000, 'web'
from public.barbershops b where b.slug = 'barberia-acepta';

select set_config('test.shop', (select id::text from public.barbershops where slug = 'barberia-acepta'), true);
set local role service_role;
select lives_ok(
  $$select public.record_privacy_acceptance(
      current_setting('test.shop')::uuid,
      'e0000000-0000-0000-0000-000000000063', '2026-11-14')$$,
  'the server keeps the customer''s acceptance of the booking'
);
reset role;
select is(
  (select row(privacy_version, privacy_accepted_at is not null)::text from public.customers
   where id = 'c0000000-0000-0000-0000-000000000063'),
  '(2026-11-14,t)', 'with its version and when'
);
set local role service_role;
select throws_ok(
  $$select public.record_privacy_acceptance(gen_random_uuid(), gen_random_uuid(), '')$$,
  '22023', null, 'never without a version'
);
reset role;

select * from finish();
rollback;
