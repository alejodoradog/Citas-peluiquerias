-- Task 1.4: signing up creates the barbershop and its owner in one step.
-- The app sends the registration as user metadata on supabase.auth.signUp.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

select is(
  (select count(*) from pg_trigger
   where tgrelid = 'auth.users'::regclass
     and tgname = 'on_auth_user_created'
     and not tgisinternal),
  1::bigint,
  'signing up runs the registration trigger'
);

-- 1. A complete registration ----------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-0000000000a1',
  'carlos@example.com',
  '{"owner_name": "  Carlos Pérez ", "barbershop_name": " Barbería El Parche ",
    "barbershop_slug": "barberia-el-parche", "phone": "+573001234567"}'
);

select is(
  (select name from public.barbershops where slug = 'barberia-el-parche'),
  'Barbería El Parche',
  'the barbershop is created with its trimmed name'
);
select is(
  (select whatsapp_phone from public.barbershops where slug = 'barberia-el-parche'),
  '+573001234567',
  'the owner phone becomes the barbershop WhatsApp'
);
select is(
  (select subscription_status::text from public.barbershops where slug = 'barberia-el-parche'),
  'trial',
  'the barbershop starts its free trial'
);
select is(
  (select plan::text from public.barbershops where slug = 'barberia-el-parche'),
  null,
  'without a plan'
);
select is(
  (select expires_on from public.barbershops where slug = 'barberia-el-parche'),
  (now() at time zone 'America/Bogota')::date + 20,
  'the trial runs through the signup day in Bogotá plus 20 days'
);
select is(
  (select m.barbershop_id from public.memberships m where m.user_id = '00000000-0000-0000-0000-0000000000a1'),
  (select b.id from public.barbershops b where b.slug = 'barberia-el-parche'),
  'the owner membership belongs to the new barbershop'
);
select is(
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'owner',
  'the account is an owner'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'Carlos Pérez',
  'the owner name is trimmed'
);

-- 2. What a signup cannot do ------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-0000000000a2',
  'tramposo@example.com',
  '{"owner_name": "Tramposo", "barbershop_name": "Otra", "barbershop_slug": "otra",
    "phone": "+573001234568", "role": "super_admin", "expires_on": "2099-12-31",
    "plan": "pro", "subscription_status": "active",
    "barbershop_id": "00000000-0000-0000-0000-000000000000"}'
);

select is(
  (select is_super_admin from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'),
  false,
  'a signup can never choose the super admin role'
);
select is(
  (select expires_on from public.barbershops where slug = 'otra'),
  (now() at time zone 'America/Bogota')::date + 20,
  'a signup can never choose its own expiry'
);

insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-0000000000ad', 'admin@example.com', '{}'
);

select is(
  (select plan::text from public.barbershops where slug = 'otra'),
  null,
  'a signup can never choose its plan'
);
select is(
  (select subscription_status::text from public.barbershops where slug = 'otra'),
  'trial',
  'a signup can never activate its subscription'
);
select isnt(
  (select barbershop_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a2'),
  (select id from public.barbershops where slug = 'barberia-el-parche'),
  'a signup always gets its own new barbershop'
);

select is_empty(
  $$select id from public.profiles where id = '00000000-0000-0000-0000-0000000000ad'$$,
  'an account created by hand without a barbershop gets no profile'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
      '00000000-0000-0000-0000-0000000000b1', 'mal@example.com',
      '{"owner_name": "Mal", "barbershop_name": "Mal", "barbershop_slug": "mal-celular", "phone": "3001234567"}')$$,
  '23514', null,
  'a signup with an unnormalized phone fails as a whole'
);
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
      '00000000-0000-0000-0000-0000000000b5', 'sin-celular@example.com',
      '{"owner_name": "Sin celular", "barbershop_name": "Sin celular", "barbershop_slug": "sin-celular"}')$$,
  '23514', null,
  'a signup without a phone fails as a whole'
);
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
      '00000000-0000-0000-0000-0000000000b6', 'extranjero@example.com',
      '{"owner_name": "Extranjero", "barbershop_name": "Extranjero", "barbershop_slug": "extranjero", "phone": "+15551234567"}')$$,
  '23514', null,
  'a signup needs a Colombian mobile'
);
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
      '00000000-0000-0000-0000-0000000000b7', 'sin-link@example.com',
      '{"owner_name": "Sin link", "barbershop_name": "Sin link", "phone": "+573001234569"}')$$,
  '23502', null,
  'a signup without a link fails as a whole'
);
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
      '00000000-0000-0000-0000-0000000000b8', 'soporte@example.com',
      '{"owner_name": "Soporte", "barbershop_name": "Soporte", "barbershop_slug": "soporte", "phone": "+573001234569"}')$$,
  '23514', null,
  'a signup cannot take a link that passes for the platform'
);
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
      '00000000-0000-0000-0000-0000000000b2', 'copia@example.com',
      '{"owner_name": "Copia", "barbershop_name": "Copia", "barbershop_slug": "barberia-el-parche", "phone": "+573001234569"}')$$,
  '23505', null,
  'a signup with a taken link fails as a whole'
);
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
      '00000000-0000-0000-0000-0000000000b3', 'ruta@example.com',
      '{"owner_name": "Ruta", "barbershop_name": "Panel", "barbershop_slug": "panel", "phone": "+573001234569"}')$$,
  '23514', null,
  'a signup cannot take the link of an app route'
);
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
      '00000000-0000-0000-0000-0000000000b4', 'anonimo@example.com',
      '{"barbershop_name": "Sin dueño", "barbershop_slug": "sin-dueno", "phone": "+573001234569"}')$$,
  '23502', null,
  'a signup without the owner name fails as a whole'
);

-- 3. After signup ------------------------------------------------------------------

update auth.users
set raw_user_meta_data = '{"owner_name": "Otro", "barbershop_name": "Segunda", "barbershop_slug": "segunda", "phone": "+573001234567"}'
where id = '00000000-0000-0000-0000-0000000000a1';

select is_empty(
  $$select id from public.barbershops where slug = 'segunda'$$,
  'changing user metadata later creates nothing'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'Carlos Pérez',
  'and changes nothing'
);

select throws_ok(
  $$update public.barbershops set slug = 'admin' where slug = 'barberia-el-parche'$$,
  '23514', null,
  'a barbershop cannot move its link onto an app route'
);

select * from finish();
rollback;
