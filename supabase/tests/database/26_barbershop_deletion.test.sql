-- Task 2.6b, migration add_barbershop_limit_and_deletion: an account holds
-- at most 4 sedes, and deletes one while it keeps another and has no
-- upcoming appointments there. The deleted sede loses every operational
-- row, keeps its payments for the super admin, disappears for its owner and
-- for anon, and sets its link aside for 90 days without counting it as a
-- change.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(52);

-- Structure and privileges ----------------------------------------------------------------

select has_column('public', 'barbershops', 'deleted_at', 'barbershops keeps when it was deleted');
select has_column('public', 'barbershops', 'deleted_by', 'and who deleted it');
select has_function('public', 'delete_barbershop', array['uuid'], 'delete_barbershop exists');
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.delete_barbershop(uuid)'::regprocedure),
  'delete_barbershop is security definer with an empty search_path'
);
select ok(
  not has_column_privilege('authenticated', 'public.barbershops', 'deleted_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.barbershops', 'deleted_by', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.barbershops', 'deleted_at', 'INSERT'),
  'no session writes the mark'
);
select ok(
  not has_column_privilege('anon', 'public.barbershops', 'deleted_at', 'SELECT')
    and not has_column_privilege('anon', 'public.barbershops', 'deleted_by', 'SELECT'),
  'anon reads neither column'
);
select ok(
  has_function_privilege('authenticated', 'public.delete_barbershop(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.delete_barbershop(uuid)', 'EXECUTE'),
  'only signed-in accounts may call delete_barbershop'
);

-- Fixtures, inserted as the table owner ------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'owner-c@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sede Uno', 'sede-uno-a', '+573001112233', current_date + 10, current_date + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Sede Dos', 'sede-dos-a', '+573001112233', current_date + 10, current_date + 10, now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sede Tres', 'sede-tres-a', '+573001112233', current_date + 10, current_date + 10, now() - interval '1 day'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Sede B', 'sede-b', '+573001112244', current_date + 10, current_date + 10, now() - interval '3 days'),
  ('cccccccc-0000-0000-0000-000000000001', 'Sede C1', 'sede-c-uno', '+573001112255', current_date + 10, current_date + 10, now() - interval '3 days'),
  ('cccccccc-0000-0000-0000-000000000002', 'Sede C2', 'sede-c-dos', '+573001112255', current_date + 10, current_date + 10, now() - interval '2 days'),
  ('cccccccc-0000-0000-0000-000000000003', 'Sede C3', 'sede-c-tres', '+573001112255', current_date + 10, current_date + 10, now() - interval '1 day');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233', false),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244', false),
  ('00000000-0000-0000-0000-00000000000c', 'Dueño C', '+573001112255', false),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', null, true);
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000003', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000002', 'owner'),
  ('00000000-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000003', 'owner');

-- Sede Dos (A2) has everything a running sede has, a past appointment, a
-- payment and a logo. Sede Tres (A3) has an upcoming appointment.
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('5e000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000002', 'Corte', 25000, 40),
  ('5e000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000003', 'Corte', 25000, 40);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash) values
  ('ba000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000002', 'Ana', repeat('a', 64)),
  ('ba000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000003', 'Beto', repeat('b', 64));
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'ba000000-0000-0000-0000-0000000000a2', '5e000000-0000-0000-0000-0000000000a2'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'ba000000-0000-0000-0000-0000000000a3', '5e000000-0000-0000-0000-0000000000a3');
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'ba000000-0000-0000-0000-0000000000a2', 1, '09:00', '18:00');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 1, '08:00', '20:00');
insert into public.holiday_openings (barbershop_id, holiday_date) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '2026-12-08');
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'ba000000-0000-0000-0000-0000000000a2', '2026-11-10 17:00Z', '2026-11-10 18:00Z', 'Almuerzo');
insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000002', 'Cliente Dos', 'cliente-dos@example.com'),
  ('c0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000003', 'Cliente Tres', 'cliente-tres@example.com');
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source) values
  ('e0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-0000000000a2',
   'ba000000-0000-0000-0000-0000000000a2', date_trunc('hour', now()) - interval '2 days',
   date_trunc('hour', now()) - interval '2 days' + interval '40 minutes', 25000, 'manual'),
  ('e0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-0000000000a3',
   'ba000000-0000-0000-0000-0000000000a3', date_trunc('hour', now()) + interval '2 days',
   date_trunc('hour', now()) + interval '2 days' + interval '40 minutes', 25000, 'manual');
-- The line logs a service_added event, so A2 has events too.
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a2', 1, '5e000000-0000-0000-0000-0000000000a2');
insert into public.notifications (barbershop_id, appointment_id, type, scheduled_for, dedupe_key) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a2', 'appointment_reminder', now() - interval '3 days', 'reminder:a2');
insert into public.subscription_payments (barbershop_id, plan, amount_cop, method, reference, paid_on, covers_from, covers_until, registered_by) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'standard', 25000, 'nequi', 'REF-A2', current_date, current_date, current_date + 30, '00000000-0000-0000-0000-0000000000ad');
-- Uploaded by the owner, as the app does.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select public.reserve_image_upload(path) from (values
  ('aaaaaaaa-0000-0000-0000-000000000002/logo/11111111-1111-4111-8111-111111111111.webp'),
  ('aaaaaaaa-0000-0000-0000-000000000002/barbers/22222222-2222-4222-8222-222222222222.webp'),
  ('aaaaaaaa-0000-0000-0000-000000000001/logo/33333333-3333-4333-8333-333333333333.webp')
) as reserved (path);
insert into storage.objects (bucket_id, name) values
  ('images', 'aaaaaaaa-0000-0000-0000-000000000002/logo/11111111-1111-4111-8111-111111111111.webp'),
  ('images', 'aaaaaaaa-0000-0000-0000-000000000002/barbers/22222222-2222-4222-8222-222222222222.webp'),
  ('images', 'aaaaaaaa-0000-0000-0000-000000000001/logo/33333333-3333-4333-8333-333333333333.webp');
reset role;
update public.barbershops
set logo_path = 'aaaaaaaa-0000-0000-0000-000000000002/logo/11111111-1111-4111-8111-111111111111.webp'
where id = 'aaaaaaaa-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from public.appointment_events where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  1,
  'the fixtures give A2 an event'
);

-- At most 4 sedes ----------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select lives_ok(
  $$select public.create_barbershop('Sede C4', 'sede-c-cuatro', null, '22222222-0000-4000-8000-000000000001')$$,
  'an owner with 3 sedes opens a fourth one'
);
select throws_ok(
  $$select public.create_barbershop('Sede C5', 'sede-c-cinco', null, '22222222-0000-4000-8000-000000000002')$$,
  '23514', 'an account holds at most 4 barbershops',
  'a fifth one is refused'
);
select throws_ok(
  $$select public.create_barbershop('Sede C5', 'sede-c-cinco', null)$$,
  '23514', 'an account holds at most 4 barbershops',
  'also without a request id'
);
select is(
  public.create_barbershop('Sede C4', 'sede-c-cuatro-2', null, '22222222-0000-4000-8000-000000000001'),
  (select id from public.barbershops where slug = 'sede-c-cuatro'),
  'the retry of the request that created the fourth one still gets it back'
);
select is(
  (select count(*)::int from public.memberships where user_id = '00000000-0000-0000-0000-00000000000c'),
  4,
  'and the account stays at 4'
);
select is(
  (select count(*)::int from public.barbershops where slug in ('sede-c-cinco', 'sede-c-cuatro-2')),
  0,
  'the refused ones left nothing'
);

-- Deleting a sede: who cannot ------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$select public.delete_barbershop('aaaaaaaa-0000-0000-0000-000000000002')$$,
  '42501', 'not allowed',
  'the owner of another account cannot delete it'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok(
  $$select public.delete_barbershop('aaaaaaaa-0000-0000-0000-000000000002')$$,
  '42501', 'not allowed',
  'nor the super admin'
);

set local role anon;
set local request.jwt.claims to '';
select throws_ok(
  $$select public.delete_barbershop('aaaaaaaa-0000-0000-0000-000000000002')$$,
  '42501', null,
  'anon cannot call delete_barbershop'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$update public.barbershops set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  '42501', null,
  'the owner cannot mark a sede as deleted by hand (and skip its checks)'
);

-- An upcoming appointment holds the sede ----------------------------------------------------------

select throws_ok(
  $$select public.delete_barbershop('aaaaaaaa-0000-0000-0000-000000000003')$$,
  '23514', 'the barbershop has upcoming appointments',
  'a sede with an upcoming appointment is not deleted'
);
select is(
  (select count(*)::int from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  1,
  'and keeps everything'
);

-- The owner deletes A2, which only has a past appointment ------------------------------------------

select lives_ok(
  $$select public.delete_barbershop('aaaaaaaa-0000-0000-0000-000000000002')$$,
  'the owner deletes a sede while keeping others'
);
select is(
  (select array_agg(id order by created_at)::text from public.barbershops),
  '{aaaaaaaa-0000-0000-0000-000000000001,aaaaaaaa-0000-0000-0000-000000000003}',
  'the owner no longer sees it'
);
select throws_ok(
  $$select public.delete_barbershop('aaaaaaaa-0000-0000-0000-000000000002')$$,
  '42501', 'not allowed',
  'deleting it again is refused: it is no longer theirs'
);
select is(
  (select count(*)::int from storage.objects where name like 'aaaaaaaa-0000-0000-0000-000000000002/%'),
  2,
  'the former owner lists the images of the deleted sede'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-0000-0000-000000000002/logo/44444444-4444-4444-8444-444444444444.webp')$$,
  '42501', null,
  'but cannot upload anything new to it'
);

reset role;

select is(
  (select
     (select count(*) from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.barber_services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.barber_schedules where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.barbershop_hours where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.holiday_openings where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.time_blocks where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.customers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.appointments where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.appointment_services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.appointment_events where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.notifications where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
     + (select count(*) from public.memberships where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002'))::int,
  0,
  'every operational row of the sede is gone: customers, appointments, team, hours, membership'
);
select is(
  (select count(*)::int from public.subscription_payments where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  1,
  'its payments stay for the accounts'
);
select ok(
  (select deleted_at is not null
     and deleted_by = '00000000-0000-0000-0000-00000000000a'
     and slug ~ '^eliminada-[0-9a-f]{32}$'
     and logo_path is null
     and whatsapp_phone is null
     and name = 'Sede Dos'
   from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'the row is marked, takes a link of its own and keeps nothing public or personal'
);
select ok(
  (select retired_at > now() - interval '1 minute'
   from public.barbershop_slug_history
   where slug = 'sede-dos-a' and barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'its link is set aside, as any link left'
);
select is(
  (select count(*)::int from public.barbershop_slug_history where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  1,
  'once: the eliminada link is not set aside'
);
select is(
  (select count(*)::int from public.barbershop_slug_changes where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'and the deletion does not count as a change of link'
);
select is(
  (select count(*)::int from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000003')
    + (select count(*)::int from public.subscription_payments),
  2,
  'the other sedes keep their data'
);
select throws_ok(
  $$update public.barbershops set slug = 'sede-dos-otra' where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  '23514', 'the barbershop was deleted',
  'the link of a deleted sede never changes again, whoever writes'
);

-- A normal change of link still counts ---------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
update public.barbershops set slug = 'sede-uno-a-nuevo' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select is(
  (select count(*)::int from public.barbershop_slug_changes where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'a change the owner makes still counts for the limit'
);

-- The former owner removes the images (the Storage API does this) -----------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(
  (select count(*)::int from storage.objects where name like 'aaaaaaaa-0000-0000-0000-000000000002/%'),
  0,
  'another owner lists nothing of the deleted sede'
);
set local storage.allow_delete_query = 'true';
delete from storage.objects where name like 'aaaaaaaa-0000-0000-0000-000000000002/%';
reset storage.allow_delete_query;
reset role;
select is(
  (select count(*)::int from storage.objects where name like 'aaaaaaaa-0000-0000-0000-000000000002/%'),
  2,
  'nor deletes it'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
set local storage.allow_delete_query = 'true';
delete from storage.objects where name like 'aaaaaaaa-0000-0000-0000-000000000002/%';
reset storage.allow_delete_query;
reset role;
select is(
  (select array_agg(name order by name)::text from storage.objects where bucket_id = 'images'),
  '{aaaaaaaa-0000-0000-0000-000000000001/logo/33333333-3333-4333-8333-333333333333.webp}',
  'the former owner deletes the images of the deleted sede, and the live sede keeps its own'
);

-- anon and the super admin ----------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '';
select is(
  (select count(*)::int from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'anon no longer reads the deleted sede'
);
select is(
  (select count(*)::int from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  1,
  'and still reads the others'
);
select is(
  (select b.slug
   from public.barbershop_slug_history h
   left join public.barbershops b on b.id = h.barbershop_id
   where h.slug = 'sede-dos-a'),
  null::text,
  'its old link leads nowhere (the page says it was not found)'
);
select is(
  (select count(*)::int from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002')
    + (select count(*)::int from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'nor anything of its booking page'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select is(
  (select count(*)::int from public.barbershops b
   join public.subscription_payments p on p.barbershop_id = b.id
   where b.id = 'aaaaaaaa-0000-0000-0000-000000000002' and b.deleted_at is not null),
  1,
  'the super admin still reads the deleted sede with its payment'
);

-- Its link, set aside for 90 days -----------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$select public.create_barbershop('Sede Dos B', 'sede-dos-a')$$,
  '23505', null,
  'no other barbershop takes the link of the deleted sede for 90 days'
);
reset role;
update public.barbershop_slug_history
set retired_at = now() - interval '90 days'
where slug = 'sede-dos-a';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select lives_ok(
  $$select public.create_barbershop('Sede Dos B', 'sede-dos-a')$$,
  'and after them, any barbershop takes it'
);

-- The upcoming appointment, cancelled; then the last sede -----------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
update public.appointments set status = 'cancelled_by_barbershop'
where id = 'e0000000-0000-0000-0000-0000000000a3';
select lives_ok(
  $$select public.delete_barbershop('aaaaaaaa-0000-0000-0000-000000000003')$$,
  'once its appointment is cancelled, the sede is deleted'
);
select throws_ok(
  $$select public.delete_barbershop('aaaaaaaa-0000-0000-0000-000000000001')$$,
  '23514', 'the account needs another barbershop',
  'the only sede left is never deleted'
);
select is(
  (select count(*)::int from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'and stays'
);

-- A deleted sede no longer counts for the limit ------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select lives_ok(
  format(
    'select public.delete_barbershop(%L)',
    (select id from public.barbershops where slug = 'sede-c-cuatro')
  ),
  'the owner at 4 sedes deletes the fourth one'
);
select throws_ok(
  $$select public.create_barbershop('Sede C4', 'sede-c-cuatro-3', null, '22222222-0000-4000-8000-000000000001')$$,
  'P0002', 'the barbershop this request created was deleted',
  'the request that created it never hands back a deleted sede, nor creates another'
);
select lives_ok(
  $$select public.create_barbershop('Sede C5', 'sede-c-cinco', null, '22222222-0000-4000-8000-000000000002')$$,
  'and a new sede fits again'
);
select is(
  (select count(*)::int from public.barbershops),
  4,
  'the account is at 4 again'
);
select throws_ok(
  $$select public.create_barbershop('Sede C6', 'sede-c-seis', null, '22222222-0000-4000-8000-000000000003')$$,
  '23514', 'an account holds at most 4 barbershops',
  'and the limit holds'
);

reset role;

select * from finish();
rollback;
