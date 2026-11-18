-- Task 8.12, migration barber_notices_always_on: a professional's notices
-- follow their email.
--
-- - Insert with an email: on, even if asked off. Without an email: off.
-- - Update that removes the email: off. That sets one: on.
-- - The owner, with their session, cannot leave them off with an email.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

-- Fixtures, inserted as the table owner ---------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000008501', 'dueno-avisos@example.com');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-000000008501', 'Dueño avisos');

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000008501', 'Sede avisos', 'sede-avisos-siempre', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000008501', 'aaaaaaaa-0000-0000-0000-000000008501', 'owner');

-- 1. Insert -------------------------------------------------------------------------------------

insert into public.barbers (id, barbershop_id, display_name, email, email_notifications, link_token_hash, sort_order) values
  ('ba000000-0000-0000-0000-000000008501', 'aaaaaaaa-0000-0000-0000-000000008501', 'Con correo', 'con@example.com', false, repeat('1', 64), 1),
  ('ba000000-0000-0000-0000-000000008502', 'aaaaaaaa-0000-0000-0000-000000008501', 'Sin correo', null, true, repeat('2', 64), 2),
  ('ba000000-0000-0000-0000-000000008503', 'aaaaaaaa-0000-0000-0000-000000008501', 'Por defecto', 'defecto@example.com', default, repeat('3', 64), 3);

select is(
  (select email_notifications from public.barbers where id = 'ba000000-0000-0000-0000-000000008501'),
  true, 'inserted with an email and notices off: they end on'
);
select is(
  (select email_notifications from public.barbers where id = 'ba000000-0000-0000-0000-000000008502'),
  false, 'inserted without an email and notices on: they end off'
);
select is(
  (select email_notifications from public.barbers where id = 'ba000000-0000-0000-0000-000000008503'),
  true, 'inserted with an email and no value: they end on'
);

-- 2. Update -------------------------------------------------------------------------------------

update public.barbers set email = null where id = 'ba000000-0000-0000-0000-000000008501';
select is(
  (select email_notifications from public.barbers where id = 'ba000000-0000-0000-0000-000000008501'),
  false, 'removing the email turns the notices off'
);

update public.barbers set email = 'nuevo@example.com' where id = 'ba000000-0000-0000-0000-000000008501';
select is(
  (select email_notifications from public.barbers where id = 'ba000000-0000-0000-0000-000000008501'),
  true, 'setting an email turns the notices on'
);

update public.barbers set email_notifications = false where id = 'ba000000-0000-0000-0000-000000008503';
select is(
  (select email_notifications from public.barbers where id = 'ba000000-0000-0000-0000-000000008503'),
  true, 'asking for off with an email, as the table owner, changes nothing'
);

-- 3. The owner, with their session -------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000008501", "role": "authenticated"}';

select lives_ok(
  $$update public.barbers set email_notifications = false
    where id = 'ba000000-0000-0000-0000-000000008503'$$,
  'the owner''s update of the notices does not fail'
);

reset role;
select is(
  (select email_notifications from public.barbers where id = 'ba000000-0000-0000-0000-000000008503'),
  true, 'but the notices stay on while the professional has an email'
);

select * from finish();
rollback;
