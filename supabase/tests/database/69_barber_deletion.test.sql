-- Task 7.6c, migration remove_barber_link_add_barber_deletion: deleting a
-- professional (decision 0010, point 7).
--
-- - Only the owner of that establishment: not anon, not another
--   establishment's owner, not the professional, not the super admin.
-- - Not while they have appointments to come (with how many), never the
--   owner who attends.
-- - The row stays as "Profesional eliminado", without personal data, and the
--   history is intact: the past appointments still point at it and the day
--   close of a past day is the same before and after.
-- - The access goes: the session reaches nothing, and the app is handed the
--   accounts to delete in Auth (the joined one, the orphan of an invitation).
-- - Frozen: no edit, no reactivation, nothing new by any path; it no longer
--   counts for the plan's limit, nor shows in the lists.
-- - It works with the establishment suspended.
-- - Independent review: an UPDATE that moves hours, services or blocks to
--   them is refused too, and a session aiming at another establishment gets
--   RLS's 42501, never whether that professional was deleted.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(64);

-- Structure and privileges -------------------------------------------------------------------

select has_column('public', 'barbers', 'deleted_at', 'barbers.deleted_at exists');
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.delete_barber(uuid)'::regprocedure,
     'public.barber_account_states(uuid)'::regprocedure,
     'public.barber_account_status(uuid)'::regprocedure,
     'public.barber_account_to_delete(uuid)'::regprocedure,
     'private.keep_deleted_barber()'::regprocedure
   )),
  'the new and replaced functions are security definer with an empty search_path'
);
select ok(
  (select not prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'private.refuse_deleted_barber()'::regprocedure),
  'refuse_deleted_barber runs as the statement''s role, with an empty search_path'
);
select ok(
  (select bool_and(
     has_function_privilege('authenticated', f, 'EXECUTE')
     and not has_function_privilege('anon', f, 'EXECUTE'))
   from unnest(array['public.delete_barber(uuid)', 'public.barber_account_states(uuid)']) f),
  'only authenticated calls delete_barber and barber_account_states'
);
select ok(
  (select bool_and(
     not has_function_privilege('anon', f, 'EXECUTE')
     and not has_function_privilege('authenticated', f, 'EXECUTE'))
   from unnest(array[
     'private.account_safe_to_delete(uuid)',
     'private.orphan_invited_account(uuid, text)',
     'private.barber_account_state(uuid, uuid, uuid)',
     'private.keep_deleted_barber()',
     'private.refuse_deleted_barber()'
   ]) f),
  'nobody calls the private helpers directly'
);
select ok(
  not has_table_privilege('authenticated', 'private.deleted_barber_accounts', 'SELECT')
    and not has_table_privilege('anon', 'private.deleted_barber_accounts', 'SELECT'),
  'no session reads the accounts waiting to be deleted'
);
select ok(
  has_column_privilege('authenticated', 'public.barbers', 'deleted_at', 'SELECT')
    and not has_column_privilege('authenticated', 'public.barbers', 'deleted_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.barbers', 'deleted_at', 'INSERT'),
  'the owner reads deleted_at and never writes it'
);

-- Helpers --------------------------------------------------------------------------------------

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

create function pg_temp.detail_of(statement text)
returns text
language plpgsql
as $$
declare
  error_detail text;
begin
  execute statement;
  return 'no error';
exception when others then
  get stacked diagnostics error_detail = pg_exception_detail;
  return error_detail;
end;
$$;

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

create function pg_temp.at(days integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'America/Bogota')::date + days) + hhmm::time) at time zone 'America/Bogota'
$$;

-- What the day close (task 4.6) reads for one Bogotá day: each appointment
-- with its barber, status and the prices its lines copied, and whether the
-- barber's row is still there to name.
create function pg_temp.day_close(shop uuid, day date)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'appointment', a.id,
    'barber', a.barber_id,
    'status', a.status,
    'total', (select sum(l.price_cop) from public.appointment_services l
              where l.barbershop_id = a.barbershop_id and l.appointment_id = a.id),
    'named', br.id is not null
  ) order by a.id), '[]'::jsonb)
  from public.appointments a
  left join public.barbers br on br.barbershop_id = a.barbershop_id and br.id = a.barber_id
  where a.barbershop_id = shop
    and a.starts_at >= day::timestamp at time zone 'America/Bogota'
    and a.starts_at < (day + 1)::timestamp at time zone 'America/Bogota'
$$;

grant execute on function pg_temp.hint_of(text), pg_temp.detail_of(text), pg_temp.as_user(uuid),
  pg_temp.at(integer, text)
  to anon, authenticated, service_role;

-- Fixtures ---------------------------------------------------------------------------------------
-- S (standard plan: 4 active) and T, each with its owner. In S: Jefa (the
-- owner who attends), Uno (with an account and a photo), Dos (an appointment
-- tomorrow) and Tres (a pending invitation, and an orphan account in Auth).
-- In T: Ocho.

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000006901', 'Barbería S', 'barberia-s-69', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '10 days'),
  ('aaaaaaaa-0000-0000-0000-000000006902', 'Barbería T', 'barberia-t-69', '+573001112244',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '10 days');
insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-000000006901', 'owner-s-69@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-000000006902', 'owner-t-69@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000069ad', 'admin-69@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000069b1', 'uno-69@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000069b2', 'dos-69@example.com', '$2a$10$x');
insert into public.profiles (id, full_name, is_super_admin, terms_accepted_at, terms_version) values
  ('00000000-0000-0000-0000-000000006901', 'Dueña S', false, null, null),
  ('00000000-0000-0000-0000-000000006902', 'Dueño T', false, null, null),
  ('00000000-0000-0000-0000-0000000069ad', 'Admin', true, null, null),
  ('00000000-0000-0000-0000-0000000069b1', 'Uno', false, now(), 'prueba-69'),
  ('00000000-0000-0000-0000-0000000069b2', 'Dos', false, now(), 'prueba-69');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000006901', 'aaaaaaaa-0000-0000-0000-000000006901', 'owner'),
  ('00000000-0000-0000-0000-000000006902', 'aaaaaaaa-0000-0000-0000-000000006902', 'owner');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select s, d, '06:00', '22:00'
from generate_series(0, 6) d,
     unnest(array['aaaaaaaa-0000-0000-0000-000000006901', 'aaaaaaaa-0000-0000-0000-000000006902']::uuid[]) s;
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('5e000000-0000-0000-0000-000000006901', 'aaaaaaaa-0000-0000-0000-000000006901', 'Corte', 25000, 30);
insert into public.barbers (id, barbershop_id, display_name, email, is_owner, photo_path, email_notifications, uses_barbershop_hours) values
  ('ba000000-0000-0000-0000-000000006900', 'aaaaaaaa-0000-0000-0000-000000006901', 'Jefa', null, true, null, false, true),
  ('ba000000-0000-0000-0000-000000006911', 'aaaaaaaa-0000-0000-0000-000000006901', 'Uno', 'uno-69@example.com', false,
   'aaaaaaaa-0000-0000-0000-000000006901/barbers/11111111-1111-1111-1111-111111111111.webp', true, false),
  ('ba000000-0000-0000-0000-000000006912', 'aaaaaaaa-0000-0000-0000-000000006901', 'Dos', 'dos-69@example.com', false, null, false, true),
  ('ba000000-0000-0000-0000-000000006913', 'aaaaaaaa-0000-0000-0000-000000006901', 'Tres', 'tres-69@example.com', false, null, false, true),
  ('ba000000-0000-0000-0000-000000006921', 'aaaaaaaa-0000-0000-0000-000000006902', 'Ocho', null, false, null, false, true);
insert into public.barber_services (barbershop_id, barber_id, service_id)
select 'aaaaaaaa-0000-0000-0000-000000006901', b, '5e000000-0000-0000-0000-000000006901'
from unnest(array['ba000000-0000-0000-0000-000000006911', 'ba000000-0000-0000-0000-000000006912']::uuid[]) b;
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006911', d, '08:00', '18:00'
from generate_series(0, 6) d;
-- Dos has a shift of their own, to try moving it to Uno.
insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
values ('aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006912', 1, '09:00', '10:00');

-- Uno joined their account by an invitation (task 7.6a) and accepted the
-- terms; Dos has an account too.
update public.barbers set profile_id = '00000000-0000-0000-0000-0000000069b1'
where id = 'ba000000-0000-0000-0000-000000006911';
update public.barbers set profile_id = '00000000-0000-0000-0000-0000000069b2'
where id = 'ba000000-0000-0000-0000-000000006912';
insert into public.barber_invitations (barbershop_id, barber_id, email, invited_by, created_at, expires_at, accepted_at)
values ('aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006911', 'uno-69@example.com',
        '00000000-0000-0000-0000-000000006901', now() - interval '2 days', now() + interval '5 days', now() - interval '2 days');

insert into public.customers (id, barbershop_id, full_name, email, phone) values
  ('c0000000-0000-0000-0000-000000006901', 'aaaaaaaa-0000-0000-0000-000000006901', 'Camila Rojas', 'camila-69@example.com', '+573009998877');

-- Uno: attended three days ago (a1), confirmed and not marked two days ago
-- (a2), cancelled tomorrow (a3). Dos: confirmed tomorrow (a4).
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, status) values
  ('a0000000-0000-0000-0000-000000006901', 'aaaaaaaa-0000-0000-0000-000000006901', 'c0000000-0000-0000-0000-000000006901',
   'ba000000-0000-0000-0000-000000006911', pg_temp.at(-3, '10:00'), pg_temp.at(-3, '10:30'), 25000, 'manual', 'confirmed'),
  ('a0000000-0000-0000-0000-000000006902', 'aaaaaaaa-0000-0000-0000-000000006901', 'c0000000-0000-0000-0000-000000006901',
   'ba000000-0000-0000-0000-000000006911', pg_temp.at(-2, '10:00'), pg_temp.at(-2, '10:30'), 25000, 'manual', 'confirmed'),
  ('a0000000-0000-0000-0000-000000006903', 'aaaaaaaa-0000-0000-0000-000000006901', 'c0000000-0000-0000-0000-000000006901',
   'ba000000-0000-0000-0000-000000006911', pg_temp.at(1, '12:00'), pg_temp.at(1, '12:30'), 25000, 'manual', 'confirmed'),
  ('a0000000-0000-0000-0000-000000006904', 'aaaaaaaa-0000-0000-0000-000000006901', 'c0000000-0000-0000-0000-000000006901',
   'ba000000-0000-0000-0000-000000006912', pg_temp.at(1, '11:00'), pg_temp.at(1, '11:30'), 25000, 'manual', 'confirmed');
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id, price_cop, duration_minutes)
select 'aaaaaaaa-0000-0000-0000-000000006901', a, 1, '5e000000-0000-0000-0000-000000006901', 25000, 30
from unnest(array['a0000000-0000-0000-0000-000000006901', 'a0000000-0000-0000-0000-000000006902',
                  'a0000000-0000-0000-0000-000000006903', 'a0000000-0000-0000-0000-000000006904']::uuid[]) a;
update public.appointments set status = 'attended' where id = 'a0000000-0000-0000-0000-000000006901';
update public.appointments set status = 'cancelled_by_customer' where id = 'a0000000-0000-0000-0000-000000006903';

-- Uno's blocks: one that ended (b1) and one to come (b2).
insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('b0000000-0000-0000-0000-000000006901', 'aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006911',
   pg_temp.at(-3, '14:00'), pg_temp.at(-3, '15:00'), 'Almuerzo'),
  ('b0000000-0000-0000-0000-000000006902', 'aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006911',
   pg_temp.at(2, '14:00'), pg_temp.at(2, '15:00'), 'Permiso'),
  -- Dos's block to come (b3), to try moving it to Uno.
  ('b0000000-0000-0000-0000-000000006903', 'aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006912',
   pg_temp.at(3, '14:00'), pg_temp.at(3, '15:00'), 'Permiso');

-- Tres: the owner invites them, and Auth holds an account for that email
-- that did not join (made before the invitation): the orphan.
select pg_temp.as_user('00000000-0000-0000-0000-000000006901');
select public.invite_barber('ba000000-0000-0000-0000-000000006913');
reset role;
select set_config('request.jwt.claims', '', true);
insert into auth.users (id, email, encrypted_password, created_at, invited_at)
values ('00000000-0000-0000-0000-0000000069c3', 'tres-69@example.com', '', now() - interval '1 day', now() - interval '1 day');

-- The fixtures' appointments pass their deferred checks now, while their
-- professionals still offer the services, as they would have at the commit
-- of their booking. From here every check runs at once.
set constraints all immediate;

create temporary table snapshot (what text primary key, value jsonb) on commit drop;
insert into snapshot values
  ('close', pg_temp.day_close('aaaaaaaa-0000-0000-0000-000000006901', private.today_bogota() - 3)),
  ('events', to_jsonb((select count(*) from public.appointment_events
                       where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000006901')));

-- Who can delete --------------------------------------------------------------------------------

select pg_temp.as_user(null);
select is(
  pg_temp.hint_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006911')$$),
  '42501',
  'anon cannot call it'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000006902');
select is(
  pg_temp.hint_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006911')$$),
  'barber_not_found',
  'the owner of another establishment does not reach the professional'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000069b2');
select is(
  pg_temp.hint_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006911')$$),
  'barber_not_found',
  'nor another professional of the same establishment, with their session'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000069b1');
select is(
  pg_temp.hint_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006911')$$),
  'barber_not_found',
  'nor the professional themself'
);
select pg_temp.as_user('00000000-0000-0000-0000-0000000069ad');
select is(
  pg_temp.hint_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006911')$$),
  'barber_not_found',
  'nor the super admin, who is no member'
);

select pg_temp.as_user('00000000-0000-0000-0000-000000006901');
select is(
  pg_temp.hint_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006900')$$),
  'barber_is_owner',
  'never the owner who attends'
);
select is(
  pg_temp.hint_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006912')$$),
  'has_upcoming_appointments',
  'not while they have an appointment to come'
);
select is(
  pg_temp.detail_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006912')$$),
  '1',
  'and the error says how many'
);
select is(
  (select display_name || ':' || active::text from public.barbers where id = 'ba000000-0000-0000-0000-000000006912'),
  'Dos:true',
  'a refused deletion leaves the professional as they were'
);

-- Deleting Uno -----------------------------------------------------------------------------------

select is(
  public.delete_barber('ba000000-0000-0000-0000-000000006911'),
  'aaaaaaaa-0000-0000-0000-000000006901/barbers/11111111-1111-1111-1111-111111111111.webp',
  'the owner deletes Uno, and gets the photo to delete in Storage'
);
select is(
  (select row(display_name, email, photo_path, active, email_notifications, deleted_at is not null)::text
   from public.barbers where id = 'ba000000-0000-0000-0000-000000006911'),
  '("Profesional eliminado",,,f,f,t)',
  'the row stays as "Profesional eliminado", without email, photo or notices, inactive'
);
reset role;
select is(
  (select row(profile_id, link_active, uses_barbershop_hours, link_token_hash = encode(sha256(convert_to('x', 'UTF8')), 'hex'))::text
   from public.barbers where id = 'ba000000-0000-0000-0000-000000006911'),
  '(,f,t,f)',
  'without an account, with the link off and the barbershop''s hours'
);
select is(
  (select count(*)::integer from public.barber_invitations where barber_id = 'ba000000-0000-0000-0000-000000006911'),
  0,
  'the invitation, with its email, is gone'
);
select is(
  (select count(*)::integer from public.barber_services where barber_id = 'ba000000-0000-0000-0000-000000006911')
  + (select count(*)::integer from public.barber_schedules where barber_id = 'ba000000-0000-0000-0000-000000006911'),
  0,
  'their services and their own hours are gone'
);
select is(
  (select array_agg(id::text order by id) from public.time_blocks where barber_id = 'ba000000-0000-0000-0000-000000006911'),
  array['b0000000-0000-0000-0000-000000006901'],
  'their blocks to come are gone; the past one stays with its day'
);
select is(
  (select count(*)::integer from public.appointments where barber_id = 'ba000000-0000-0000-0000-000000006911'),
  3,
  'their appointments still point at the row'
);
select is(
  pg_temp.day_close('aaaaaaaa-0000-0000-0000-000000006901', private.today_bogota() - 3),
  (select value from snapshot where what = 'close'),
  'the day close of a past day is the same before and after'
);
select is(
  to_jsonb((select count(*) from public.appointment_events
            where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000006901')),
  (select value from snapshot where what = 'events'),
  'and the history of the appointments did not change'
);
select is(
  (select active from public.profiles where id = '00000000-0000-0000-0000-0000000069b1'),
  false,
  'their account''s profile is off'
);

-- The session of the deleted professional reaches nothing.
select pg_temp.as_user('00000000-0000-0000-0000-0000000069b1');
select is(public.my_professional_access(), null, 'their session is no professional any more');
select is(public.my_agenda((now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date), null, 'their agenda gives nothing');
select is(
  pg_temp.hint_of($$select public.create_my_time_block(now() + interval '1 day', now() + interval '1 day 1 hour', null)$$),
  'not_professional',
  'and they change nothing'
);

-- The account to delete in Auth, only for the owner.
select pg_temp.as_user('00000000-0000-0000-0000-000000006902');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006911'), null,
  'another establishment''s owner gets no account to delete');
select pg_temp.as_user('00000000-0000-0000-0000-000000006901');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006911'),
  '00000000-0000-0000-0000-0000000069b1'::uuid,
  'the owner gets the account Uno had, for the app to delete in Auth');
reset role;
select set_config('request.jwt.claims', '', true);
delete from auth.users where id = '00000000-0000-0000-0000-0000000069b1';
select pg_temp.as_user('00000000-0000-0000-0000-000000006901');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006911'), null,
  'once Auth deleted it, there is nothing left to delete');

-- A deleted professional stays as they are ---------------------------------------------------------

select is(
  pg_temp.hint_of($$update public.barbers set display_name = 'Uno otra vez' where id = 'ba000000-0000-0000-0000-000000006911'$$),
  'barber_deleted',
  'the owner cannot edit them'
);
select is(
  pg_temp.hint_of($$update public.barbers set active = true where id = 'ba000000-0000-0000-0000-000000006911'$$),
  'barber_deleted',
  'nor bring them back'
);
select is(
  pg_temp.hint_of($$select public.set_barber_services('ba000000-0000-0000-0000-000000006911', array['5e000000-0000-0000-0000-000000006901']::uuid[])$$),
  'barber_deleted',
  'nor give them services'
);
select is(
  pg_temp.hint_of($$select public.set_barber_schedule('ba000000-0000-0000-0000-000000006911', false, '[{"weekday": 1, "start": "09:00", "end": "10:00"}]')$$),
  'barber_deleted',
  'nor hours'
);
select is(
  pg_temp.hint_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006911')$$),
  'barber_deleted',
  'nor delete them twice'
);
select is(
  pg_temp.hint_of($$select * from public.invite_barber('ba000000-0000-0000-0000-000000006911')$$),
  'barber_inactive',
  'nor invite them'
);
select is(
  pg_temp.hint_of($$select public.set_appointment_status('a0000000-0000-0000-0000-000000006902', 'attended')$$),
  'no error',
  'but the owner still marks a past appointment of theirs'
);

-- Independent review, point 1: moving a row of Dos to Uno with a direct
-- UPDATE, as the owner may by RLS.
select is(
  pg_temp.hint_of($$update public.barber_services set barber_id = 'ba000000-0000-0000-0000-000000006911'
    where barber_id = 'ba000000-0000-0000-0000-000000006912'$$),
  'barber_deleted',
  'the owner cannot move services to them by an UPDATE'
);
select is(
  pg_temp.hint_of($$update public.barber_schedules set barber_id = 'ba000000-0000-0000-0000-000000006911'
    where barber_id = 'ba000000-0000-0000-0000-000000006912'$$),
  'barber_deleted',
  'nor hours'
);
select throws_ok(
  $$update public.time_blocks set barber_id = 'ba000000-0000-0000-0000-000000006911'
    where id = 'b0000000-0000-0000-0000-000000006903'$$,
  '42501', null,
  'a session updates no block at all'
);

-- Independent review, point 2: another establishment's owner aiming at Uno
-- gets RLS's answer, the same as for a professional who was not deleted.
select pg_temp.as_user('00000000-0000-0000-0000-000000006902');
select is(
  pg_temp.hint_of($$insert into public.barber_services (barbershop_id, barber_id, service_id)
    values ('aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006911', '5e000000-0000-0000-0000-000000006901')$$),
  '42501',
  'another establishment''s owner learns nothing of a deleted professional (42501)'
);
select is(
  pg_temp.hint_of($$insert into public.barber_services (barbershop_id, barber_id, service_id)
    values ('aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006912', '5e000000-0000-0000-0000-000000006901')$$),
  '42501',
  'the same answer as for one who was not'
);

-- The public booking (a security definer function, by the server key) still
-- refuses them.
reset role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
set local role service_role;
select is(
  pg_temp.hint_of(format(
    $$select * from public.book_appointment_from_app(p_barbershop_id => %L, p_starts_at => %L,
      p_service_ids => %L, p_customer_name => 'Camila Ruiz', p_customer_email => 'camila-69b@example.com',
      p_manage_token_hash => %L, p_barber_id => %L, p_customer_phone => '+573001112299')$$,
    'aaaaaaaa-0000-0000-0000-000000006901', pg_temp.at(4, '10:00'),
    array['5e000000-0000-0000-0000-000000006901']::uuid[], repeat('f', 64),
    'ba000000-0000-0000-0000-000000006911')),
  'barber_unavailable',
  'the public booking never books a deleted professional'
);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000006901');

-- Nothing new for them, by any path (as the table owner, past every grant).
-- The older guards already refuse an inactive professional, reading the row
-- without a lock; they are switched off here (inside this transaction) so
-- these see the new wall, whose lock also orders a booking and a deletion
-- made at the same time.
reset role;
select set_config('request.jwt.claims', '', true);
set constraints all immediate;
alter table public.appointments disable trigger check_appointment_rules;
alter table public.time_blocks disable trigger check_time_block_rules;
select is(
  pg_temp.hint_of($$insert into public.appointments (barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source)
    values ('aaaaaaaa-0000-0000-0000-000000006901', 'c0000000-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006911',
            pg_temp.at(3, '10:00'), pg_temp.at(3, '10:30'), 25000, 'manual')$$),
  'barber_deleted',
  'no new appointment'
);
select is(
  pg_temp.hint_of($$update public.appointments set barber_id = 'ba000000-0000-0000-0000-000000006911'
    where id = 'a0000000-0000-0000-0000-000000006904'$$),
  'barber_deleted',
  'nor one moved to them'
);
select is(
  pg_temp.hint_of($$update public.appointments set status = 'confirmed'
    where id = 'a0000000-0000-0000-0000-000000006903'$$),
  'barber_deleted',
  'nor a cancelled one brought back to come'
);
select is(
  pg_temp.hint_of($$insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at)
    values ('aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006911', pg_temp.at(3, '14:00'), pg_temp.at(3, '15:00'))$$),
  'barber_deleted',
  'no block'
);
select is(
  pg_temp.hint_of($$insert into public.barber_services (barbershop_id, barber_id, service_id)
    values ('aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006911', '5e000000-0000-0000-0000-000000006901')$$),
  'barber_deleted',
  'no service'
);
select is(
  pg_temp.hint_of($$insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
    values ('aaaaaaaa-0000-0000-0000-000000006901', 'ba000000-0000-0000-0000-000000006911', 2, '09:00', '10:00')$$),
  'barber_deleted',
  'no hours'
);
select is(
  pg_temp.hint_of($$update public.barbers set display_name = 'Otra' where id = 'ba000000-0000-0000-0000-000000006911'$$),
  'barber_deleted',
  'and not even the table owner edits the row'
);
select is(
  pg_temp.hint_of($$update public.time_blocks set barber_id = 'ba000000-0000-0000-0000-000000006911'
    where id = 'b0000000-0000-0000-0000-000000006903'$$),
  'barber_deleted',
  'nor moves a block to them'
);
set constraints all immediate;
alter table public.appointments enable trigger check_appointment_rules;
alter table public.time_blocks enable trigger check_time_block_rules;

-- The lists and the plan ---------------------------------------------------------------------------

select pg_temp.as_user(null);
select is(
  (select array_agg(display_name order by display_name) from public.barbers
   where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000006901'),
  array['Dos', 'Jefa', 'Tres'],
  'the public page does not show them'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000006901');
select is(
  (select array_agg(barber_id::text || ':' || state order by barber_id)
   from public.barber_account_states('aaaaaaaa-0000-0000-0000-000000006901')),
  array['ba000000-0000-0000-0000-000000006912:active', 'ba000000-0000-0000-0000-000000006913:invited'],
  'the owner''s list of accesses: not the owner who attends, not the deleted one'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000006902');
select is(
  (select count(*)::integer from public.barber_account_states('aaaaaaaa-0000-0000-0000-000000006901')),
  0,
  'another establishment''s owner gets nothing of it'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000006901');
select is(
  pg_temp.hint_of($$insert into public.barbers (barbershop_id, display_name, sort_order)
    values ('aaaaaaaa-0000-0000-0000-000000006901', 'Nueva', 9)$$),
  'no error',
  'with Uno deleted, the plan takes a new professional (3 active + 1)'
);
select is(
  pg_temp.hint_of($$insert into public.barbers (barbershop_id, display_name, sort_order)
    values ('aaaaaaaa-0000-0000-0000-000000006901', 'Otra Más', 10)$$),
  'plan_limit',
  'but not a fifth: the deleted one never counted again'
);

-- The orphan of an invitation ------------------------------------------------------------------------

select is(
  pg_temp.hint_of($$select public.delete_barber('ba000000-0000-0000-0000-000000006913')$$),
  'no error',
  'the owner deletes Tres, who only had an invitation'
);
select is(
  public.barber_account_to_delete('ba000000-0000-0000-0000-000000006913'),
  '00000000-0000-0000-0000-0000000069c3'::uuid,
  'and gets the orphan account of that invitation, for the app to delete'
);

-- Suspended: deleting still works ---------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '', true);
update public.barbershops set subscription_status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000006901';
insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at)
select 'aaaaaaaa-0000-0000-0000-000000006901', id, pg_temp.at(4, '14:00'), pg_temp.at(4, '15:00')
from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000006901' and display_name = 'Nueva';
select pg_temp.as_user('00000000-0000-0000-0000-000000006901');
select is(
  pg_temp.hint_of(format($$select public.delete_barber(%L)$$,
    (select id from public.barbers where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000006901' and display_name = 'Nueva'))),
  'no error',
  'a suspended establishment still deletes a professional (as revoking an account)'
);
reset role;
select is(
  (select count(*)::integer from public.time_blocks t
   join public.barbers b on b.id = t.barber_id
   where b.barbershop_id = 'aaaaaaaa-0000-0000-0000-000000006901' and b.sort_order = 9),
  0,
  'with their blocks to come'
);
select is(coalesce(current_setting('yapoin.deleting_barber', true), ''), '',
  'and the setting does not outlive the function');
select pg_temp.as_user('00000000-0000-0000-0000-000000006901');
select is(
  pg_temp.hint_of($$update public.barbers set display_name = 'Dos Bis' where id = 'ba000000-0000-0000-0000-000000006912'$$),
  'barbershop_read_only',
  'while any other change of a professional still waits for a payment'
);

select * from finish();
rollback;
