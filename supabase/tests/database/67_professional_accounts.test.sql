-- Task 7.6a, migration add_professional_accounts: accounts of professionals
-- by invitation (decision 0010).
--
-- - The professional has an account but is not a member: barbers.profile_id
--   ties the account to their row, and RLS gives them nothing.
-- - invite_barber: only a member of a writable barbershop, for an active
--   professional that is not the owner, with an email no account uses, and
--   at most 20 a day per barbershop. Inviting again renews.
-- - The account is joined by on_auth_user_invited only when Auth invited it
--   (invited_at, set by an update after the insert), it has no password and
--   no confirmation yet, and there is one pending invitation for its email.
-- - my_* do exactly what the link functions do, for the professional of the
--   session; my_appointment also brings the customer's phone.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(121);

-- Structure and privileges -------------------------------------------------------------------

select has_column('public', 'barbers', 'profile_id', 'barbers.profile_id exists');
select col_is_unique('public', 'barbers', 'profile_id', 'one professional per account');
select is(
  (select confdeltype::text from pg_constraint
   where conrelid = 'public.barbers'::regclass and contype = 'f'
     and conkey = array[(select attnum from pg_attribute
                         where attrelid = 'public.barbers'::regclass and attname = 'profile_id')]),
  'n',
  'deleting the account leaves the professional, without it (on delete set null)'
);
select has_table('public', 'barber_invitations', 'barber_invitations exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.barber_invitations'::regclass),
  'barber_invitations has RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.barber_invitations', 'INSERT')
    and not has_table_privilege('authenticated', 'public.barber_invitations', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.barber_invitations', 'DELETE')
    and not has_table_privilege('anon', 'public.barber_invitations', 'SELECT'),
  'nobody writes invitations directly, and anon does not read them'
);
select ok(
  not has_column_privilege('authenticated', 'public.barbers', 'profile_id', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.barbers', 'profile_id', 'SELECT')
    and not has_column_privilege('anon', 'public.barbers', 'profile_id', 'SELECT'),
  'no session reads or writes barbers.profile_id'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.invite_barber(uuid)'::regprocedure,
     'public.my_agenda(date, date)'::regprocedure,
     'public.my_appointment(uuid)'::regprocedure,
     'public.mark_my_appointment(uuid, public.appointment_status)'::regprocedure,
     'public.create_my_time_block(timestamptz, timestamptz, text)'::regprocedure,
     'public.delete_my_time_block(uuid)'::regprocedure,
     'public.my_professional_access()'::regprocedure
   )),
  'the session functions are security definer with an empty search_path'
);
select ok(
  (select bool_and(
     has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
   from unnest(array[
     'public.invite_barber(uuid)',
     'public.my_agenda(date, date)',
     'public.my_appointment(uuid)',
     'public.mark_my_appointment(uuid, public.appointment_status)',
     'public.create_my_time_block(timestamptz, timestamptz, text)',
     'public.delete_my_time_block(uuid)',
     'public.my_professional_access()'
   ]) f),
  'only authenticated calls them; anon cannot'
);
select ok(
  (select bool_and(
     not has_function_privilege('anon', p.oid, 'EXECUTE')
     and not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   from pg_proc p
   where p.oid in (
     'private.barber_by_session()'::regprocedure,
     'private.link_invited_professional()'::regprocedure,
     'private.barber_agenda_of(private.barber_access, date, date)'::regprocedure,
     'private.barber_appointment_of(private.barber_access, uuid)'::regprocedure,
     'private.mark_appointment_of(private.barber_access, uuid, public.appointment_status)'::regprocedure,
     'private.create_time_block_of(private.barber_access, timestamptz, timestamptz, text)'::regprocedure,
     'private.delete_time_block_of(private.barber_access, uuid)'::regprocedure
   )),
  'nobody calls the private helpers directly'
);
select is(
  (select pg_get_function_result('public.my_appointment(uuid)'::regprocedure)),
  'TABLE(id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, '
    'status appointment_status, source appointment_source, created_at timestamp with time zone, '
    'customer_name text, customer_phone text, service_names text[], service_minutes integer[], '
    'visits integer, no_shows integer, writable boolean)',
  'my_appointment is B-03 plus the customer''s phone: no price, email or notes'
);
select is(
  (select pg_get_function_result('public.barber_appointment(text, uuid)'::regprocedure)),
  'TABLE(id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, '
    'status appointment_status, source appointment_source, created_at timestamp with time zone, '
    'customer_name text, service_names text[], service_minutes integer[], visits integer, '
    'no_shows integer, writable boolean)',
  'barber_appointment, by the link, still has no phone'
);
select ok(
  exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_invited'),
  'the trigger that joins an invited account exists'
);

-- Helpers --------------------------------------------------------------------------------------

create function pg_temp.h(token text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;

create function pg_temp.at(days integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'America/Bogota')::date + days) + hhmm::time) at time zone 'America/Bogota'
$$;

create function pg_temp.hint_of(statement text)
returns text
language plpgsql
as $$
declare
  error_hint text;
begin
  execute statement;
  return 'no error';
exception when others then
  get stacked diagnostics error_hint = pg_exception_hint;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;

create function pg_temp.d(days integer)
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Bogota')::date + days
$$;

-- The session of a user (null: anon).
create function pg_temp.as_user(user_id uuid)
returns void
language plpgsql
as $$
begin
  if user_id is null then
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end;
$$;

-- What Auth does when it invites: insert the user, then set invited_at.
create function pg_temp.invited_by_auth(user_id uuid, user_email text)
returns void
language sql
as $$
  select set_config('request.jwt.claims', '', true);
  insert into auth.users (id, email, encrypted_password, created_at) values (user_id, user_email, '', now());
  update auth.users set invited_at = now(), confirmation_sent_at = now() where id = user_id;
$$;

grant execute on function pg_temp.h(text), pg_temp.at(integer, text), pg_temp.hint_of(text),
  pg_temp.d(integer), pg_temp.as_user(uuid)
  to anon, authenticated;

-- Fixtures, as the table owner -------------------------------------------------------------------
-- S and T are active barbershops; P is suspended.

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000067', 'Barbería S', 'barberia-s-67', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000068', 'Barbería T', 'barberia-t-67', '+573001112244',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000069', 'Barbería P', 'barberia-p-67', '+573001112255',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
update public.barbershops set subscription_status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000000069';

insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-000000006701', 'owner-s@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-000000006702', 'Owner-T@Example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-000000006703', 'owner-p@example.com', '$2a$10$x');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-000000006701', 'Dueña S'),
  ('00000000-0000-0000-0000-000000006702', 'Dueño T'),
  ('00000000-0000-0000-0000-000000006703', 'Dueño P');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000006701', 'aaaaaaaa-0000-0000-0000-000000000067', 'owner'),
  ('00000000-0000-0000-0000-000000006702', 'aaaaaaaa-0000-0000-0000-000000000068', 'owner'),
  ('00000000-0000-0000-0000-000000006703', 'aaaaaaaa-0000-0000-0000-000000000069', 'owner');

insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select s, d, '06:00', '22:00'
from generate_series(0, 6) d,
     unnest(array['aaaaaaaa-0000-0000-0000-000000000067', 'aaaaaaaa-0000-0000-0000-000000000068']::uuid[]) s;
insert into public.holiday_openings (barbershop_id, holiday_date)
select s, pg_temp.d(n)
from generate_series(0, 8) n,
     unnest(array['aaaaaaaa-0000-0000-0000-000000000067', 'aaaaaaaa-0000-0000-0000-000000000068']::uuid[]) s
where private.is_colombian_holiday(pg_temp.d(n));

insert into public.barbers (id, barbershop_id, display_name, email, link_token_hash, is_owner, active, link_active) values
  ('ba000000-0000-0000-0000-000000006711', 'aaaaaaaa-0000-0000-0000-000000000067', 'Kevin Mora', 'uno@example.com', pg_temp.h('uno67'), false, true, true),
  ('ba000000-0000-0000-0000-000000006712', 'aaaaaaaa-0000-0000-0000-000000000067', 'Dos', 'dos@example.com', pg_temp.h('dos67'), false, true, true),
  ('ba000000-0000-0000-0000-000000006713', 'aaaaaaaa-0000-0000-0000-000000000067', 'Jefa', 'jefa@example.com', pg_temp.h('jefa67'), true, true, false),
  ('ba000000-0000-0000-0000-000000006714', 'aaaaaaaa-0000-0000-0000-000000000067', 'Sin Correo', null, pg_temp.h('sin67'), false, true, true),
  ('ba000000-0000-0000-0000-000000006715', 'aaaaaaaa-0000-0000-0000-000000000067', 'Inactivo', 'inactivo@example.com', pg_temp.h('ina67'), false, false, true),
  ('ba000000-0000-0000-0000-000000006716', 'aaaaaaaa-0000-0000-0000-000000000067', 'Cuenta', 'owner-t@example.com', pg_temp.h('cta67'), false, true, true),
  ('ba000000-0000-0000-0000-000000006717', 'aaaaaaaa-0000-0000-0000-000000000067', 'Cinco', 'cinco@example.com', pg_temp.h('cin67'), false, true, true),
  ('ba000000-0000-0000-0000-000000006718', 'aaaaaaaa-0000-0000-0000-000000000067', 'Seis', 'seis@example.com', pg_temp.h('sei67'), false, true, true),
  ('ba000000-0000-0000-0000-000000006719', 'aaaaaaaa-0000-0000-0000-000000000067', 'Siete', 'siete@example.com', pg_temp.h('sie67'), false, true, true),
  ('ba000000-0000-0000-0000-00000000671a', 'aaaaaaaa-0000-0000-0000-000000000067', 'Ocho', 'ocho@example.com', pg_temp.h('och67'), false, true, true),
  ('ba000000-0000-0000-0000-000000006721', 'aaaaaaaa-0000-0000-0000-000000000068', 'Tres', 'tres@example.com', pg_temp.h('tre67'), false, true, true),
  ('ba000000-0000-0000-0000-000000006722', 'aaaaaaaa-0000-0000-0000-000000000068', 'Doble', 'dos@example.com', pg_temp.h('dob67'), false, true, true),
  ('ba000000-0000-0000-0000-000000006731', 'aaaaaaaa-0000-0000-0000-000000000069', 'Pausa', 'pausa@example.com', pg_temp.h('pau67'), false, true, true);

insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000006701', 'aaaaaaaa-0000-0000-0000-000000000067', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000006702', 'aaaaaaaa-0000-0000-0000-000000000068', 'Corte T', 20000, 30, true);

insert into public.customers (id, barbershop_id, full_name, email, phone, notes) values
  ('c0000000-0000-0000-0000-000000006701', 'aaaaaaaa-0000-0000-0000-000000000067',
   'Camila Rojas Pérez', 'camila@example.com', '+573009998877', 'nota privada'),
  ('c0000000-0000-0000-0000-000000006702', 'aaaaaaaa-0000-0000-0000-000000000067',
   'Diego Díaz', 'diego@example.com', '+573005554433', null),
  ('c0000000-0000-0000-0000-000000006703', 'aaaaaaaa-0000-0000-0000-000000000068',
   'Cliente De Te', 'te@example.com', '+573001110000', null);

-- Uno: a1 started 30 minutes ago, a2 tomorrow 10:00. Dos: a3 tomorrow 11:00
-- (customer Diego). Tres, in T: a4 tomorrow 10:00.
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, status) values
  ('a0000000-0000-0000-0000-000000006701', 'aaaaaaaa-0000-0000-0000-000000000067', 'c0000000-0000-0000-0000-000000006701',
   'ba000000-0000-0000-0000-000000006711', now() - interval '30 minutes', now() + interval '15 minutes', 25000, 'web', 'confirmed'),
  ('a0000000-0000-0000-0000-000000006702', 'aaaaaaaa-0000-0000-0000-000000000067', 'c0000000-0000-0000-0000-000000006701',
   'ba000000-0000-0000-0000-000000006711', pg_temp.at(1, '10:00'), pg_temp.at(1, '10:30'), 25000, 'web', 'confirmed'),
  ('a0000000-0000-0000-0000-000000006703', 'aaaaaaaa-0000-0000-0000-000000000067', 'c0000000-0000-0000-0000-000000006702',
   'ba000000-0000-0000-0000-000000006712', now() - interval '20 minutes', now() + interval '10 minutes', 25000, 'manual', 'confirmed'),
  ('a0000000-0000-0000-0000-000000006704', 'aaaaaaaa-0000-0000-0000-000000000068', 'c0000000-0000-0000-0000-000000006703',
   'ba000000-0000-0000-0000-000000006721', now() - interval '20 minutes', now() + interval '10 minutes', 20000, 'web', 'confirmed');
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id, price_cop, duration_minutes) values
  ('aaaaaaaa-0000-0000-0000-000000000067', 'a0000000-0000-0000-0000-000000006701', 1, '5e000000-0000-0000-0000-000000006701', 25000, 30);

-- Blocks: Uno tomorrow 14-15 (b1), Dos tomorrow 14-15 (b2), the whole of S
-- in two days 06-08 (b3), Tres in T tomorrow 14-15 (b4).
insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('b0000000-0000-0000-0000-000000006701', 'aaaaaaaa-0000-0000-0000-000000000067', 'ba000000-0000-0000-0000-000000006711',
   pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00'), 'Almuerzo'),
  ('b0000000-0000-0000-0000-000000006702', 'aaaaaaaa-0000-0000-0000-000000000067', 'ba000000-0000-0000-0000-000000006712',
   pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00'), 'Permiso'),
  ('b0000000-0000-0000-0000-000000006703', 'aaaaaaaa-0000-0000-0000-000000000067', null,
   pg_temp.at(2, '06:00'), pg_temp.at(2, '08:00'), null),
  ('b0000000-0000-0000-0000-000000006704', 'aaaaaaaa-0000-0000-0000-000000000068', 'ba000000-0000-0000-0000-000000006721',
   pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00'), null);

-- 1. invite_barber -----------------------------------------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-000000006701');

select is(
  public.invite_barber('ba000000-0000-0000-0000-000000006711'),
  'uno@example.com',
  'the owner of S invites Uno and gets the email to send it to'
);
select is(
  (select row(email, barbershop_id, invited_by, accepted_at is null,
              expires_at = created_at + interval '7 days')::text
   from public.barber_invitations where barber_id = 'ba000000-0000-0000-0000-000000006711'),
  '(uno@example.com,aaaaaaaa-0000-0000-0000-000000000067,00000000-0000-0000-0000-000000006701,t,t)',
  'a pending invitation of 7 days, that the owner reads'
);
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006721')$$),
  'barber_not_found',
  'not a professional of another barbershop'
);
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006714')$$),
  'email_required',
  'not without an email'
);
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006715')$$),
  'barber_inactive',
  'not an inactive professional'
);
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006713')$$),
  'barber_is_owner',
  'not the owner who also attends'
);
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006716')$$),
  'email_taken',
  'not an email that already has an account, whatever its case (decision 0010, point 3)'
);
select is(
  pg_temp.hint_of($$select public.invite_barber(null)$$),
  'barber_not_found',
  'nor nothing'
);
select is(public.invite_barber('ba000000-0000-0000-0000-000000006712'), 'dos@example.com', 'the owner invites Dos');

-- Inviting again renews: the same row, a new expiry.
reset role;
update public.barber_invitations
set created_at = now() - interval '6 days', expires_at = now() + interval '1 day'
where barber_id = 'ba000000-0000-0000-0000-000000006711';
select pg_temp.as_user('00000000-0000-0000-0000-000000006701');
select is(public.invite_barber('ba000000-0000-0000-0000-000000006711'), 'uno@example.com', 'the owner invites Uno again');
select is(
  (select count(*)::integer from public.barber_invitations where barber_id = 'ba000000-0000-0000-0000-000000006711'),
  1,
  'still one invitation per professional'
);
select ok(
  (select expires_at = now() + interval '7 days' from public.barber_invitations
   where barber_id = 'ba000000-0000-0000-0000-000000006711'),
  'with 7 days again'
);
select is(
  (select count(*)::integer from public.barber_invitations
   where barbershop_id <> 'aaaaaaaa-0000-0000-0000-000000000067'),
  0,
  'the owner of S reads no invitation of another barbershop'
);
select is(
  (select count(*)::integer from public.barber_invitations
   where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000067'),
  2,
  'only those of S'
);

-- Owner T: not a professional of S; not an email another barbershop invited.
select pg_temp.as_user('00000000-0000-0000-0000-000000006702');
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006711')$$),
  'barber_not_found',
  'the owner of T cannot invite a professional of S'
);
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006722')$$),
  'email_taken',
  'nor an email with a pending invitation elsewhere, without saying where'
);
select is(
  (select count(*)::integer from public.barber_invitations),
  0,
  'and reads none of the invitations of S'
);

-- The limit of 20 a day (decision 0010, question 7): 19 already today.
reset role;
insert into private.barber_invitation_sends (barbershop_id, day, sent)
values ('aaaaaaaa-0000-0000-0000-000000000068', private.today_bogota(), 19);
select pg_temp.as_user('00000000-0000-0000-0000-000000006702');
select is(public.invite_barber('ba000000-0000-0000-0000-000000006721'), 'tres@example.com', 'the 20th invitation of the day goes');
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006721')$$),
  'invitation_limit',
  'the 21st does not, not even a renewal'
);
reset role;
select is(
  (select sent from private.barber_invitation_sends
   where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000068' and day = private.today_bogota()),
  20,
  'the refused one is not counted'
);
update private.barber_invitation_sends set day = day - 1
where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000068';
select pg_temp.as_user('00000000-0000-0000-0000-000000006702');
select is(public.invite_barber('ba000000-0000-0000-0000-000000006721'), 'tres@example.com',
  'a new Bogotá day starts from zero');

-- A suspended barbershop does not invite.
select pg_temp.as_user('00000000-0000-0000-0000-000000006703');
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006731')$$),
  'barbershop_read_only',
  'a read only barbershop does not invite'
);

-- Anon cannot call it.
select pg_temp.as_user(null);
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006711')$$),
  '42501',
  'anon cannot invite'
);
reset role;

-- 2. Joining the account ----------------------------------------------------------------------

-- Uno: Auth invites, and the account is joined.
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000067a1', 'uno@example.com');
select is(
  (select profile_id from public.barbers where id = 'ba000000-0000-0000-0000-000000006711'),
  '00000000-0000-0000-0000-0000000067a1'::uuid,
  'an account invited by Auth is joined to its professional'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000067a1'),
  'Kevin Mora',
  'with a profile named as the professional'
);
select is(
  (select count(*)::integer from public.memberships where user_id = '00000000-0000-0000-0000-0000000067a1'),
  0,
  'and no membership'
);
select ok(
  (select accepted_at is not null from public.barber_invitations
   where barber_id = 'ba000000-0000-0000-0000-000000006711'),
  'the invitation is accepted'
);
select ok(
  (select email_notifications from public.barbers where id = 'ba000000-0000-0000-0000-000000006711'),
  'and the notice of each booking is on (decision 0010, question 5)'
);

-- Dos: someone signs up by the normal page with Dos's email and their own
-- password. Not joined; not even when Auth invites that account afterwards.
insert into auth.users (id, email, encrypted_password, created_at)
values ('00000000-0000-0000-0000-0000000067a2', 'dos@example.com', '$2a$10$attackerpassword', now());
select is(
  (select profile_id from public.barbers where id = 'ba000000-0000-0000-0000-000000006712'),
  null,
  'an account of the normal sign-up with the invited email is not joined'
);
update auth.users set invited_at = now() where id = '00000000-0000-0000-0000-0000000067a2';
select is(
  (select profile_id from public.barbers where id = 'ba000000-0000-0000-0000-000000006712'),
  null,
  'nor when Auth invites it afterwards: it has a password someone else chose'
);
select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-0000000067a2'),
  0,
  'and it gets no profile'
);

-- Cinco: the invitation expired.
select pg_temp.as_user('00000000-0000-0000-0000-000000006701');
select is(public.invite_barber('ba000000-0000-0000-0000-000000006717'), 'cinco@example.com', 'the owner invites Cinco');
reset role;
update public.barber_invitations
set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
where barber_id = 'ba000000-0000-0000-0000-000000006717';
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000067a5', 'cinco@example.com');
select is(
  (select profile_id from public.barbers where id = 'ba000000-0000-0000-0000-000000006717'),
  null,
  'an expired invitation joins nothing'
);

-- Siete: Auth may also insert with invited_at already set.
select pg_temp.as_user('00000000-0000-0000-0000-000000006701');
select is(public.invite_barber('ba000000-0000-0000-0000-000000006719'), 'siete@example.com', 'the owner invites Siete');
reset role;
insert into auth.users (id, email, encrypted_password, invited_at, created_at)
values ('00000000-0000-0000-0000-0000000067a7', 'siete@example.com', '', now(), now());
select is(
  (select profile_id from public.barbers where id = 'ba000000-0000-0000-0000-000000006719'),
  '00000000-0000-0000-0000-0000000067a7'::uuid,
  'an account inserted already invited is joined too'
);

-- Ocho: an account older than the invitation, without password (a magic
-- link sign-up), invited afterwards: not joined.
select pg_temp.as_user('00000000-0000-0000-0000-000000006701');
select is(public.invite_barber('ba000000-0000-0000-0000-00000000671a'), 'ocho@example.com', 'the owner invites Ocho');
reset role;
insert into auth.users (id, email, encrypted_password, created_at)
values ('00000000-0000-0000-0000-0000000067a8', 'ocho@example.com', '', now() - interval '1 hour');
update auth.users set invited_at = now() where id = '00000000-0000-0000-0000-0000000067a8';
select is(
  (select profile_id from public.barbers where id = 'ba000000-0000-0000-0000-00000000671a'),
  null,
  'an account that existed before the invitation is not joined'
);

-- Seis: joined; a second account for the same email (another case) is not.
select pg_temp.as_user('00000000-0000-0000-0000-000000006701');
select is(public.invite_barber('ba000000-0000-0000-0000-000000006718'), 'seis@example.com', 'the owner invites Seis');
reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000067a6', 'seis@example.com');
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000067b6', 'SEIS@example.com');
select is(
  (select profile_id from public.barbers where id = 'ba000000-0000-0000-0000-000000006718'),
  '00000000-0000-0000-0000-0000000067a6'::uuid,
  'a second account cannot be joined to the same professional'
);
select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-0000000067b6'),
  0,
  'and gets no profile'
);
select is(
  pg_temp.hint_of($$update public.barbers set profile_id = '00000000-0000-0000-0000-0000000067a6'
                    where id = 'ba000000-0000-0000-0000-000000006719'$$),
  '23505',
  'one account is never joined to two professionals'
);
select is(
  pg_temp.hint_of($$update public.barbers set profile_id = '00000000-0000-0000-0000-000000006701'
                    where id = 'ba000000-0000-0000-0000-000000006713'$$),
  '23514',
  'the owner who attends never carries an account of professional'
);

-- Auth sends the invitation again (it updates invited_at): nothing changes.
update auth.users set invited_at = now() where id = '00000000-0000-0000-0000-0000000067a1';
select is(
  (select count(*)::integer from public.barbers where profile_id = '00000000-0000-0000-0000-0000000067a1'),
  1,
  'a resent invitation keeps the professional joined once'
);

-- Back to invite_barber, with accounts now joined.
select pg_temp.as_user('00000000-0000-0000-0000-000000006701');
select is(public.invite_barber('ba000000-0000-0000-0000-000000006711'), 'uno@example.com',
  'while the account is not confirmed, the owner can send the invitation again');
select ok(
  (select accepted_at is not null from public.barber_invitations
   where barber_id = 'ba000000-0000-0000-0000-000000006711'),
  'and it stays accepted, joined to the same account'
);
update public.barbers set email = 'seis-otro@example.com' where id = 'ba000000-0000-0000-0000-000000006718';
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006718')$$),
  'invitation_pending_other_email',
  'a professional joined to an unconfirmed account of another email is not invited again'
);
reset role;
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000067a1';
select pg_temp.as_user('00000000-0000-0000-0000-000000006701');
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006711')$$),
  'already_linked',
  'once the professional accepted, there is nothing to invite'
);

-- 3. A professional with a session reads no table ----------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-0000000067a1');
select is((select count(*)::integer from public.barbers), 0, 'the professional reads no barbers');
select is((select count(*)::integer from public.appointments), 0, 'no appointments');
select is((select count(*)::integer from public.customers), 0, 'no customers');
select is((select count(*)::integer from public.services), 0, 'no services');
select is((select count(*)::integer from public.time_blocks), 0, 'no blocks');
select is((select count(*)::integer from public.barbershops), 0, 'no barbershops');
select is((select count(*)::integer from public.memberships), 0, 'no memberships');
select is((select count(*)::integer from public.barber_invitations), 0, 'no invitations');
select is((select count(*)::integer from public.appointment_events), 0, 'no history');
select is((select count(*)::integer from public.barber_schedules), 0, 'no schedules');
select is(
  pg_temp.hint_of($$update public.barbers set display_name = 'Yo' where id = 'ba000000-0000-0000-0000-000000006711'$$),
  'no error',
  'an update of their own row runs...'
);
reset role;
select is(
  (select display_name from public.barbers where id = 'ba000000-0000-0000-0000-000000006711'),
  'Kevin Mora',
  '...and changes nothing'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000067a1');
select is(
  pg_temp.hint_of($$select public.invite_barber('ba000000-0000-0000-0000-000000006712')$$),
  'barber_not_found',
  'the professional does not invite'
);
select is(
  pg_temp.hint_of($$select public.create_barbershop('Mía', 'mia-67', null, null)$$),
  '42501',
  'nor creates a barbershop'
);
select is(
  pg_temp.hint_of($$select public.list_customers('aaaaaaaa-0000-0000-0000-000000000067', null, null, 10)$$) <> 'no error'
    or (select count(*) from public.list_customers('aaaaaaaa-0000-0000-0000-000000000067', null, null, 10)) = 0,
  true,
  'nor lists the customers of the barbershop'
);

-- 4. my_professional_access ----------------------------------------------------------------------

select is(
  public.my_professional_access(),
  jsonb_build_object(
    'barberId', 'ba000000-0000-0000-0000-000000006711',
    'name', 'Kevin Mora',
    'active', true,
    'barbershop', jsonb_build_object('name', 'Barbería S', 'slug', 'barberia-s-67', 'writable', true)
  ),
  'the session is of Uno, of Barbería S'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000006701');
select is(public.my_professional_access(), null, 'the session of an owner is not of a professional');
select pg_temp.as_user('00000000-0000-0000-0000-0000000067a2');
select is(public.my_professional_access(), null, 'nor that of an account that is not joined');

-- 5. The functions by session, as Uno ----------------------------------------------------------------

create temporary table agenda (week jsonb) on commit drop;
grant all on agenda to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000067a1');
insert into agenda select public.my_agenda(pg_temp.d(-1), pg_temp.d(5));

select is((select week #>> '{barber,name}' from agenda), 'Kevin Mora', 'my_agenda opens the agenda of Uno');
select is(
  (select array_agg(e ->> 'id' order by e ->> 'id') from agenda, jsonb_array_elements(week -> 'appointments') e),
  array['a0000000-0000-0000-0000-000000006701', 'a0000000-0000-0000-0000-000000006702'],
  'only their own appointments: not those of Dos, not those of another barbershop'
);
select is(
  (select array_agg(e ->> 'id' order by e ->> 'id') from agenda, jsonb_array_elements(week -> 'blocks') e),
  array['b0000000-0000-0000-0000-000000006701', 'b0000000-0000-0000-0000-000000006703'],
  'their own blocks and the closures of the whole barbershop'
);
select ok(
  (select week::text !~* '(price|camila@|\+57300|nota privada|Rojas|Diego|Tres|Barbería T)' from agenda),
  'no price, email, phone, notes, full name, other professional or other barbershop'
);
select is(
  (select week from agenda),
  public.barber_agenda(pg_temp.h('uno67'), pg_temp.d(-1), pg_temp.d(5)),
  'exactly what the link shows'
);
select is(
  pg_temp.hint_of($$select public.my_agenda(pg_temp.d(0), pg_temp.d(7))$$),
  'range_invalid',
  'at most 7 days, as the link'
);

select is(
  (select row(customer_name, customer_phone, service_names, visits, no_shows, writable)::text
   from public.my_appointment('a0000000-0000-0000-0000-000000006701')),
  '("Camila R.",+573009998877,{Corte},0,0,t)',
  'my_appointment brings the phone of their own customer (decision 0010, point 6)'
);
select is(
  (select count(*)::integer from public.my_appointment('a0000000-0000-0000-0000-000000006703')),
  0,
  'not an appointment, nor the phone, of a customer of Dos'
);
select is(
  (select count(*)::integer from public.my_appointment('a0000000-0000-0000-0000-000000006704')),
  0,
  'nor of another barbershop'
);
select is(
  (select count(*)::integer from public.barber_appointment(pg_temp.h('uno67'), 'a0000000-0000-0000-0000-000000006701')),
  1,
  'the link still shows the appointment (without the phone, by its type)'
);

select is(
  pg_temp.hint_of($$select public.mark_my_appointment('a0000000-0000-0000-0000-000000006703', 'attended')$$),
  'not_yours',
  'Uno does not mark an appointment of Dos'
);
select is(
  pg_temp.hint_of($$select public.mark_my_appointment('a0000000-0000-0000-0000-000000006704', 'attended')$$),
  'not_yours',
  'nor one of another barbershop'
);
select is(
  pg_temp.hint_of($$select public.mark_my_appointment('a0000000-0000-0000-0000-000000006702', 'attended')$$),
  'too_early',
  'nor one that has not started'
);
select is(
  pg_temp.hint_of($$select public.mark_my_appointment('a0000000-0000-0000-0000-000000006701', 'cancelled_by_barbershop')$$),
  'status_invalid',
  'only attended or no-show'
);
select is(
  pg_temp.hint_of($$select public.mark_my_appointment('a0000000-0000-0000-0000-000000006701', 'attended')$$),
  'no error',
  'Uno marks their own appointment that started'
);
reset role;
select is(
  (select row(actor, actor_user_id)::text from public.appointment_events
   where appointment_id = 'a0000000-0000-0000-0000-000000006701' and new_status = 'attended'),
  '(barber,00000000-0000-0000-0000-0000000067a1)',
  'the history records the professional, with their account'
);
select is(
  (select status::text from public.appointments where id = 'a0000000-0000-0000-0000-000000006703'),
  'confirmed',
  'the appointment of Dos is untouched'
);

select pg_temp.as_user('00000000-0000-0000-0000-0000000067a1');
select is(
  pg_temp.hint_of($$select public.create_my_time_block(pg_temp.at(1, '16:00'), pg_temp.at(1, '17:00'), 'Diligencia')$$),
  'no error',
  'Uno blocks tomorrow 16:00-17:00'
);
reset role;
select is(
  (select barbershop_id::text || ' ' || coalesce(reason, '') from public.time_blocks
   where barber_id = 'ba000000-0000-0000-0000-000000006711' and starts_at = pg_temp.at(1, '16:00')),
  'aaaaaaaa-0000-0000-0000-000000000067 Diligencia',
  'the block is theirs, in their barbershop'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000067a1');
select is(
  pg_temp.hint_of($$select public.create_my_time_block(pg_temp.at(1, '10:00'), pg_temp.at(1, '10:30'), null)$$),
  'overlaps_appointment',
  'not over an appointment of their own'
);
select is(
  pg_temp.hint_of($$select public.create_my_time_block(pg_temp.at(1, '14:30'), pg_temp.at(1, '15:30'), null)$$),
  'overlaps_block',
  'nor over a block of their own'
);
select is(
  pg_temp.hint_of($$select public.create_my_time_block(pg_temp.at(1, '22:00'), pg_temp.at(1, '23:00'), null)$$),
  'already_closed',
  'nor over closed time'
);
select is(
  pg_temp.hint_of($$select public.delete_my_time_block('b0000000-0000-0000-0000-000000006702')$$),
  'not_yours',
  'Uno does not remove a block of Dos'
);
select is(
  pg_temp.hint_of($$select public.delete_my_time_block('b0000000-0000-0000-0000-000000006703')$$),
  'not_yours',
  'nor a closure of the whole barbershop'
);
select is(
  pg_temp.hint_of($$select public.delete_my_time_block('b0000000-0000-0000-0000-000000006704')$$),
  'not_yours',
  'nor a block of another barbershop'
);
select is(
  pg_temp.hint_of($$select public.delete_my_time_block('b0000000-0000-0000-0000-000000006701')$$),
  'no error',
  'Uno removes their own block'
);
reset role;
select is(
  (select count(*)::integer from public.time_blocks
   where id in ('b0000000-0000-0000-0000-000000006701', 'b0000000-0000-0000-0000-000000006702',
                'b0000000-0000-0000-0000-000000006703', 'b0000000-0000-0000-0000-000000006704')),
  3,
  'only that one is gone'
);

-- 6. Sessions without a professional ------------------------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-000000006701');
select is(public.my_agenda(pg_temp.d(0), pg_temp.d(1)), null, 'an owner gets no agenda by session');
select is(
  (select count(*)::integer from public.my_appointment('a0000000-0000-0000-0000-000000006701')),
  0,
  'nor an appointment'
);
select is(
  pg_temp.hint_of($$select public.mark_my_appointment('a0000000-0000-0000-0000-000000006702', 'attended')$$),
  'not_professional',
  'nor marks one'
);
select is(
  pg_temp.hint_of($$select public.create_my_time_block(pg_temp.at(1, '18:00'), pg_temp.at(1, '19:00'), null)$$),
  'not_professional',
  'nor blocks'
);
select is(
  pg_temp.hint_of($$select public.delete_my_time_block('b0000000-0000-0000-0000-000000006702')$$),
  'not_professional',
  'nor removes a block'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000067a2');
select is(public.my_agenda(pg_temp.d(0), pg_temp.d(1)), null,
  'the account of the normal sign-up with an invited email gets nothing');

-- 7. Inactive professional, suspended and deleted barbershop -----------------------------------

reset role;
update public.barbers set active = false where id = 'ba000000-0000-0000-0000-000000006711';
select pg_temp.as_user('00000000-0000-0000-0000-0000000067a1');
select is(
  (public.my_agenda(pg_temp.d(0), pg_temp.d(1))) #> '{barber,active}',
  'false'::jsonb,
  'an inactive professional still sees their agenda, as by the link'
);
select is(
  pg_temp.hint_of($$select public.create_my_time_block(pg_temp.at(1, '18:00'), pg_temp.at(1, '19:00'), null)$$),
  'barber_inactive',
  'but does not block'
);
reset role;
update public.barbers set active = true where id = 'ba000000-0000-0000-0000-000000006711';

-- Uno marks a1 back as confirmed is not possible from the app; for the
-- suspended case a new appointment that already started.
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, status) values
  ('a0000000-0000-0000-0000-000000006709', 'aaaaaaaa-0000-0000-0000-000000000067', 'c0000000-0000-0000-0000-000000006701',
   'ba000000-0000-0000-0000-000000006711', now() - interval '90 minutes', now() - interval '60 minutes', 25000, 'manual', 'confirmed');
update public.barbershops set subscription_status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000000067';
select pg_temp.as_user('00000000-0000-0000-0000-0000000067a1');
select is(
  (public.my_professional_access()) #> '{barbershop,writable}',
  'false'::jsonb,
  'a suspended barbershop is read only for the professional'
);
select is(
  pg_temp.hint_of($$select public.mark_my_appointment('a0000000-0000-0000-0000-000000006709', 'no_show')$$),
  'no error',
  'a suspended barbershop still lets the professional mark'
);
select is(
  pg_temp.hint_of($$select public.create_my_time_block(pg_temp.at(1, '18:00'), pg_temp.at(1, '19:00'), null)$$),
  'read_only',
  'but not block'
);
select is(
  pg_temp.hint_of($$select public.delete_my_time_block('b0000000-0000-0000-0000-000000006701')$$),
  'read_only',
  'nor remove a block'
);

-- A deactivated profile, and a deleted barbershop, give nothing.
reset role;
update public.profiles set active = false where id = '00000000-0000-0000-0000-0000000067a1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000067a1');
select is(public.my_professional_access(), null, 'a deactivated account is not a professional');
reset role;
update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000067a1';
update public.barbershops set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000067';
select pg_temp.as_user('00000000-0000-0000-0000-0000000067a1');
select is(public.my_agenda(pg_temp.d(0), pg_temp.d(0)), null, 'the agenda of a deleted barbershop gives nothing');
select is(public.my_professional_access(), null, 'nor its access');

-- 8. Deleting the account leaves the professional -------------------------------------------------

reset role;
set local request.jwt.claims to '';
delete from auth.users where id = '00000000-0000-0000-0000-0000000067a7';
select is(
  (select row(profile_id is null, display_name)::text from public.barbers where id = 'ba000000-0000-0000-0000-000000006719'),
  '(t,Siete)',
  'deleting the account of Siete leaves their row, without an account'
);

select * from finish();
rollback;
