-- Task 1.9, migration add_create_barbershop (decision 0006): an owner opens
-- another barbershop from the same account, sharing the company's free trial.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

select has_column('public', 'barbershops', 'trial_ends_on', 'barbershops keeps the last day of the trial');
select has_function('public', 'create_barbershop', array['text', 'text', 'text'], 'create_barbershop exists');

-- Fixtures, inserted as the table owner -------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'owner-expired@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'owner-c@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sin-sede@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');

insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10),
  ('eeeeeeee-0000-0000-0000-000000000000', 'Sede vencida', 'sede-vencida', current_date - 30, current_date - 30),
  ('cccccccc-0000-0000-0000-000000000000', 'Sede C', 'sede-c', current_date + 10, current_date + 10);

insert into public.profiles (id, full_name, phone, active, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233', true, false),
  ('00000000-0000-0000-0000-00000000000e', 'Dueño vencido', '+573001112244', true, false),
  ('00000000-0000-0000-0000-00000000000c', 'Dueño C', '+573001112255', false, false),
  ('00000000-0000-0000-0000-00000000000f', 'Sin sede', '+573001112266', true, false),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', null, true, true);

insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000e', 'eeeeeeee-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000000', 'owner');

select is(
  (select trial_ends_on from public.barbershops where slug = 'sede-a'),
  current_date + 10,
  'an existing barbershop keeps its trial end'
);

-- An owner opens a second barbershop ---------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$select public.create_barbershop('  Sede Norte ', 'sede-norte', null)$$,
  'an active owner creates another barbershop'
);
select is(
  (select trial_ends_on from public.barbershops where slug = 'sede-norte'),
  current_date + 10,
  'the new barbershop shares the trial of the first one'
);
select is(
  (select expires_on from public.barbershops where slug = 'sede-norte'),
  current_date + 10,
  'and expires with it'
);
select is(
  (select name || ' ' || whatsapp_phone from public.barbershops where slug = 'sede-norte'),
  'Sede Norte +573001112233',
  'the name is trimmed and the owner phone is the default WhatsApp'
);
select is(
  (select count(*)::int from public.memberships where barbershop_id = (select id from public.barbershops where slug = 'sede-norte') and role = 'owner'),
  1,
  'the owner membership is created with it'
);
select throws_ok(
  $$select public.create_barbershop('Copia', 'sede-norte', null)$$,
  '23505', null,
  'a link that is taken fails'
);
select throws_ok(
  $$select public.create_barbershop('Panel', 'panel', null)$$,
  '23514', null,
  'a reserved link fails'
);
select throws_ok(
  $$select public.create_barbershop('Mal', 'Mal Link', null)$$,
  '23514', null,
  'an invalid link fails'
);
select throws_ok(
  $$select public.create_barbershop('Celular', 'sede-celular', '3001234567')$$,
  '23514', null,
  'a phone that is not a Colombian mobile in E.164 fails'
);
select is(
  (select count(*)::int from public.barbershops where slug in ('sede-celular', 'Mal Link', 'panel')
     or name in ('Copia', 'Mal', 'Celular', 'Panel')),
  0,
  'a failed creation leaves nothing behind'
);

-- A barbershop created after the company trial ended -----------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';

select lives_ok(
  $$select public.create_barbershop('Sede tardía', 'sede-tardia', '+573009998877')$$,
  'an owner whose trial ended can still create a barbershop'
);

reset role;

select is(
  (select trial_ends_on from public.barbershops where slug = 'sede-tardia'),
  current_date - 30,
  'it inherits the ended trial, so it waits for its first payment'
);

-- Who cannot -------------------------------------------------------------------------

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select throws_ok(
  $$select public.create_barbershop('Del admin', 'sede-admin', null)$$,
  '42501', 'not allowed',
  'a super admin cannot create a barbershop'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$select public.create_barbershop('Inactivo', 'sede-inactivo', null)$$,
  '42501', 'not allowed',
  'an inactive profile cannot create a barbershop'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000f", "role": "authenticated"}';
select throws_ok(
  $$select public.create_barbershop('Sin sede', 'sede-sin-sede', null)$$,
  '42501', 'not allowed',
  'an account without a membership cannot create a barbershop'
);

set local role anon;
set local request.jwt.claims to '';
select throws_ok(
  $$select public.create_barbershop('Anónimo', 'sede-anonima', null)$$,
  '42501', null,
  'anon cannot call create_barbershop'
);

select * from finish();
rollback;
