-- Task 7.6b, migration add_professional_account_app.
--
-- - "mi-agenda" is reserved: no barbershop takes it as its link.
-- - barber_account_status: the owner of the professional reads the state of
--   their access (none, invited, active, revoked); nobody else learns it.
-- - barber_account_to_delete: only the account this barbershop revoked, or
--   the orphan Auth made for its invitation; never an owner, a super admin,
--   an active profile or anyone's professional.
-- - accept_professional_terms: only the professional of the session, on
--   their own profile.
-- - The review of 7.6a: revoke_barber_account never returns a member's
--   account; the trigger allows a minute between the clocks; a super admin
--   does not revoke; after revoking, my_appointment and delete_my_time_block
--   answer nothing; the edges of the days with the customer's phone.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(99);

-- Structure and privileges -------------------------------------------------------------------

select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where oid in (
     'public.barber_account_status(uuid)'::regprocedure,
     'public.barber_account_to_delete(uuid)'::regprocedure,
     'public.accept_professional_terms(text)'::regprocedure,
     'public.revoke_barber_account(uuid)'::regprocedure,
     'private.link_invited_professional()'::regprocedure
   )),
  'the new and replaced functions are security definer with an empty search_path'
);
select ok(
  (select bool_and(
     has_function_privilege('authenticated', f, 'EXECUTE')
     and not has_function_privilege('anon', f, 'EXECUTE'))
   from unnest(array[
     'public.barber_account_status(uuid)',
     'public.barber_account_to_delete(uuid)',
     'public.accept_professional_terms(text)',
     'public.revoke_barber_account(uuid)'
   ]) f),
  'only authenticated calls them; anon cannot'
);
select ok(
  not has_function_privilege('authenticated', 'private.link_invited_professional()', 'EXECUTE')
    and not has_function_privilege('anon', 'private.link_invited_professional()', 'EXECUTE'),
  'nobody calls the trigger function'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'terms_version', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'UPDATE'),
  'a session still cannot write its acceptance directly'
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

-- What Auth does when it invites: insert the user, then set invited_at;
-- with Auth's clock `skew` away from Postgres' now().
create function pg_temp.invited_by_auth(user_id uuid, user_email text, skew interval default '0')
returns void
language sql
as $$
  select set_config('request.jwt.claims', '', true);
  insert into auth.users (id, email, encrypted_password, created_at) values (user_id, user_email, '', now() + skew);
  update auth.users set invited_at = now() + skew, confirmation_sent_at = now() where id = user_id;
$$;

create function pg_temp.state_of(barber uuid)
returns text
language plpgsql
as $$
declare
  answer record;
  error_hint text;
begin
  select * into answer from public.barber_account_status(barber);
  return answer.state;
exception when others then
  get stacked diagnostics error_hint = pg_exception_hint;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;

create function pg_temp.inv(barber uuid)
returns text
language plpgsql
as $$
declare
  answer record;
  error_hint text;
begin
  select * into answer from public.invite_barber(barber);
  return case when answer.status = 'invited' then answer.email else answer.status end;
exception when others then
  get stacked diagnostics error_hint = pg_exception_hint;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;

create function pg_temp.at(days integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'America/Bogota')::date + days) + hhmm::time) at time zone 'America/Bogota'
$$;

create function pg_temp.linked(barber uuid)
returns uuid
language sql
as $$
  select profile_id from public.barbers where id = barber
$$;

grant execute on function pg_temp.hint_of(text), pg_temp.as_user(uuid), pg_temp.state_of(uuid),
  pg_temp.inv(uuid), pg_temp.at(integer, text)
  to anon, authenticated;

-- Fixtures ---------------------------------------------------------------------------------------
-- S, T and X are active barbershops, each with its owner. X is where an
-- account becomes a member, to see what the functions refuse.

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000006801', 'Barbería S', 'barberia-s-68', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000006802', 'Barbería T', 'barberia-t-68', '+573001112244',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000006803', 'Barbería X', 'barberia-x-68', '+573001112255',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
-- More professionals than the first plan allows (task 7.8): these barbershops
-- take the plan without a limit, as the tests of 7.6a do.
update public.barbershops set selected_plan = 'por_acuerdo'
where id::text like 'aaaaaaaa-0000-0000-0000-0000000068%';
insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-000000006801', 'owner-s-68@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-000000006802', 'owner-t-68@example.com', '$2a$10$x'),
  ('00000000-0000-0000-0000-0000000068ad', 'admin-68@example.com', '$2a$10$x');
insert into public.profiles (id, full_name, is_super_admin) values
  ('00000000-0000-0000-0000-000000006801', 'Dueña S', false),
  ('00000000-0000-0000-0000-000000006802', 'Dueño T', false),
  ('00000000-0000-0000-0000-0000000068ad', 'Admin', true);
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000006801', 'aaaaaaaa-0000-0000-0000-000000006801', 'owner'),
  ('00000000-0000-0000-0000-000000006802', 'aaaaaaaa-0000-0000-0000-000000006802', 'owner');
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select 'aaaaaaaa-0000-0000-0000-000000006801', d, '06:00', '22:00' from generate_series(0, 6) d;
insert into public.barbers (id, barbershop_id, display_name, email, link_token_hash)
select ('ba000000-0000-0000-0000-0000000068' || v.k)::uuid, v.shop::uuid, v.name, v.email,
       encode(sha256(convert_to(v.name || '68', 'UTF8')), 'hex')
from (values
  ('11', 'aaaaaaaa-0000-0000-0000-000000006801', 'Uno', 'uno-68@example.com'),
  ('12', 'aaaaaaaa-0000-0000-0000-000000006801', 'Dos', 'dos-68@example.com'),
  ('13', 'aaaaaaaa-0000-0000-0000-000000006801', 'Sin Correo', null),
  ('14', 'aaaaaaaa-0000-0000-0000-000000006801', 'Reloj', 'reloj-68@example.com'),
  ('15', 'aaaaaaaa-0000-0000-0000-000000006801', 'Huerfano', 'huerfano-68@example.com'),
  ('16', 'aaaaaaaa-0000-0000-0000-000000006801', 'Miembro', 'miembro-68@example.com'),
  ('17', 'aaaaaaaa-0000-0000-0000-000000006801', 'Agenda', 'agenda-68@example.com'),
  ('18', 'aaaaaaaa-0000-0000-0000-000000006801', 'Cambio', 'cambio-68@example.com'),
  ('19', 'aaaaaaaa-0000-0000-0000-000000006801', 'Vee', 'vee-68@example.com'),
  ('1a', 'aaaaaaaa-0000-0000-0000-000000006801', 'Google', 'google-68@example.com'),
  ('1b', 'aaaaaaaa-0000-0000-0000-000000006801', 'Perfil', 'perfil-68@example.com'),
  ('21', 'aaaaaaaa-0000-0000-0000-000000006802', 'Tres', 'tres-68@example.com'),
  ('22', 'aaaaaaaa-0000-0000-0000-000000006802', 'Vee T', 'vee-68@example.com')
) as v (k, shop, name, email);

-- The reserved route -------------------------------------------------------------------------

select throws_ok(
  $$insert into public.barbershops (name, slug, whatsapp_phone, expires_on)
    values ('Mi Agenda', 'mi-agenda', '+573001112299', private.today_bogota() + 10)$$,
  '23514',
  null,
  '"mi-agenda" is a route: no barbershop takes it'
);
select lives_ok(
  $$insert into public.barbershops (name, slug, whatsapp_phone, expires_on)
    values ('Mi Agenda Bella', 'mi-agenda-bella', '+573001112299', private.today_bogota() + 10)$$,
  'a link that only starts like it is fine'
);

-- barber_account_status --------------------------------------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006811'), 'none', 'never invited: none');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006813'), 'none',
  'without email it is none too (the app says it needs one)');
select is(
  (select row(sent_at, expires_at)::text from public.barber_account_status('ba000000-0000-0000-0000-000000006811')),
  '(,)',
  'none has no dates'
);

select is(pg_temp.inv('ba000000-0000-0000-0000-000000006811'), 'uno-68@example.com', 'the owner invites Uno');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006811'), 'invited',
  'pending invitation, no account yet: invited');
select ok(
  (select sent_at <= now() and expires_at > now() + interval '6 days'
   from public.barber_account_status('ba000000-0000-0000-0000-000000006811')),
  'with when it was sent and the 7 days it lasts'
);
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'a pending invitation without account has nothing to delete');

reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000068e1', 'uno-68@example.com');
select is(pg_temp.linked('ba000000-0000-0000-0000-000000006811'),
  '00000000-0000-0000-0000-0000000068e1'::uuid, 'Auth made the account and it joined');
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006811'), 'invited',
  'joined but the email link not opened yet: still invited');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'a joined account is never deleted');

reset role;
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000068e1';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006811'), 'active',
  'the link was opened: active');

-- Nobody else learns it.
select pg_temp.as_user('00000000-0000-0000-0000-000000006802');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006811'), 'barber_not_found',
  'the owner of T does not read a professional of S');
select pg_temp.as_user('00000000-0000-0000-0000-0000000068e1');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006811'), 'barber_not_found',
  'the professional does not read it, not even their own');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006812'), 'barber_not_found',
  'nor another professional''s');
select pg_temp.as_user('00000000-0000-0000-0000-0000000068ad');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006811'), 'barber_not_found',
  'nor a super admin (no owner of S)');
select pg_temp.as_user(null);
select is(pg_temp.hint_of($$select * from public.barber_account_status('ba000000-0000-0000-0000-000000006811')$$),
  '42501', 'anon cannot call it');

-- accept_professional_terms ----------------------------------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-0000000068e1');
select is(pg_temp.hint_of($$select public.accept_professional_terms('2026-11-15.3')$$), 'no error',
  'the professional accepts');
reset role;
select is(
  (select terms_version from public.profiles where id = '00000000-0000-0000-0000-0000000068e1'),
  '2026-11-15.3', 'their profile keeps the version');
select ok(
  (select terms_accepted_at is not null from public.profiles where id = '00000000-0000-0000-0000-0000000068e1'),
  'and when');
select is(
  (select count(*)::integer from public.profiles where terms_version = '2026-11-15.3'), 1,
  'and only theirs');

select pg_temp.as_user('00000000-0000-0000-0000-0000000068e1');
select is(pg_temp.hint_of($$select public.accept_professional_terms('  ')$$), 'version_invalid',
  'an empty version is refused');
select is(pg_temp.hint_of($$select public.accept_professional_terms(repeat('x', 21))$$), 'version_invalid',
  'a version too long is refused');
select is(pg_temp.hint_of($$select public.accept_professional_terms(null)$$), 'version_invalid',
  'a missing version is refused');
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(pg_temp.hint_of($$select public.accept_professional_terms('2026-11-15.3')$$), 'not_professional',
  'an owner does not record through it');
select pg_temp.as_user('00000000-0000-0000-0000-0000000068ad');
select is(pg_temp.hint_of($$select public.accept_professional_terms('2026-11-15.3')$$), 'not_professional',
  'nor a super admin');
select pg_temp.as_user(null);
select is(pg_temp.hint_of($$select public.accept_professional_terms('2026-11-15.3')$$), '42501',
  'anon cannot call it');

-- Revoking, and the revoked account --------------------------------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-0000000068ad');
select is(pg_temp.hint_of($$select public.revoke_barber_account('ba000000-0000-0000-0000-000000006811')$$),
  'barber_not_found', 'a super admin does not revoke');
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.revoke_barber_account('ba000000-0000-0000-0000-000000006811'),
  '00000000-0000-0000-0000-0000000068e1'::uuid, 'the owner takes the access away');
select is(pg_temp.state_of('ba000000-0000-0000-0000-000000006811'), 'revoked', 'revoked');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'),
  '00000000-0000-0000-0000-0000000068e1'::uuid, 'and now that account may be deleted');

select pg_temp.as_user('00000000-0000-0000-0000-000000006802');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'the owner of T never gets it');
select pg_temp.as_user('00000000-0000-0000-0000-0000000068ad');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'nor a super admin');
select pg_temp.as_user('00000000-0000-0000-0000-0000000068e1');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'nor the revoked account itself');
select is(pg_temp.hint_of($$select public.accept_professional_terms('2026-11-15.3')$$), 'not_professional',
  'which no longer records anything either');

-- Never an account that is anything else now.
reset role;
insert into public.memberships (user_id, barbershop_id, role)
values ('00000000-0000-0000-0000-0000000068e1', 'aaaaaaaa-0000-0000-0000-000000006803', 'owner');
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'not if the account is a member of a barbershop');
reset role;
delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000068e1';
update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-0000000068e1';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'not if it is a super admin');
reset role;
update public.profiles set is_super_admin = false, active = true where id = '00000000-0000-0000-0000-0000000068e1';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'not if its profile is active again');
reset role;
update public.profiles set active = false where id = '00000000-0000-0000-0000-0000000068e1';
update public.barbers set profile_id = '00000000-0000-0000-0000-0000000068e1'
where id = 'ba000000-0000-0000-0000-000000006821';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'not if it is the professional of someone');
reset role;
update public.barbers set profile_id = null where id = 'ba000000-0000-0000-0000-000000006821';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'),
  '00000000-0000-0000-0000-0000000068e1'::uuid, 'back to nothing but revoked: it may be deleted');

-- Deleting it in Auth (what the app does with the service key) leaves the
-- professional and the invitation without it, ready to invite again.
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000068e1';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006811'), null,
  'once deleted, there is nothing left to delete');
select is(pg_temp.inv('ba000000-0000-0000-0000-000000006811'), 'uno-68@example.com',
  'and the same email can be invited again');

-- A revoked pending invitation (no account) has nothing to delete.
select is(pg_temp.inv('ba000000-0000-0000-0000-000000006812'), 'dos-68@example.com', 'the owner invites Dos');
select is(public.revoke_barber_account('ba000000-0000-0000-0000-000000006812'), null,
  'and revokes before Auth made the account');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006812'), null,
  'nothing to delete');

-- Review of 7.6a, point 1: a member's account is unjoined, never returned.
select is(pg_temp.inv('ba000000-0000-0000-0000-000000006816'), 'miembro-68@example.com', 'the owner invites Miembro');
reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000068e6', 'miembro-68@example.com');
insert into public.memberships (user_id, barbershop_id, role)
values ('00000000-0000-0000-0000-0000000068e6', 'aaaaaaaa-0000-0000-0000-000000006803', 'owner');
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.revoke_barber_account('ba000000-0000-0000-0000-000000006816'), null,
  'revoking a member''s account returns nothing for the app to delete');
reset role;
select is(
  (select row(pg_temp.linked('ba000000-0000-0000-0000-000000006816'),
              (select active from public.profiles where id = '00000000-0000-0000-0000-0000000068e6'),
              (select revoked_profile_id from public.barber_invitations
               where barber_id = 'ba000000-0000-0000-0000-000000006816'))::text),
  '(,t,)',
  'it is unjoined, its profile stays on and the invitation does not keep it'
);
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006816'), null,
  'and it is never offered for deletion');

-- Review of 7.6a, point 2: the clocks ------------------------------------------------------------

select is(pg_temp.inv('ba000000-0000-0000-0000-000000006814'), 'reloj-68@example.com', 'the owner invites Reloj');
reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000068e4', 'reloj-68@example.com', '-30 seconds');
select is(pg_temp.linked('ba000000-0000-0000-0000-000000006814'),
  '00000000-0000-0000-0000-0000000068e4'::uuid,
  'Auth''s clock 30 seconds behind still joins the account');

-- An orphan: Auth made the account more than a minute "before" (the clock
-- far off), so it did not join. The owner gets a way out.
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(pg_temp.inv('ba000000-0000-0000-0000-000000006815'), 'huerfano-68@example.com', 'the owner invites Huerfano');
reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000068e5', 'huerfano-68@example.com', '-2 minutes');
select is(pg_temp.linked('ba000000-0000-0000-0000-000000006815'), null,
  'two minutes before the invitation: not joined');
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(pg_temp.inv('ba000000-0000-0000-0000-000000006815'), 'email_taken',
  'inviting again finds the email taken by the orphan');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006815'),
  '00000000-0000-0000-0000-0000000068e5'::uuid, 'the orphan is offered for deletion');
select pg_temp.as_user('00000000-0000-0000-0000-000000006802');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006815'), null,
  'never to another owner');
reset role;
update auth.users set encrypted_password = '$2a$10$y' where id = '00000000-0000-0000-0000-0000000068e5';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006815'), null,
  'nor an account with a password (someone uses it)');
reset role;
update auth.users set encrypted_password = '', email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000068e5';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006815'), null,
  'nor a confirmed one');
reset role;
update auth.users set email_confirmed_at = null where id = '00000000-0000-0000-0000-0000000068e5';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.revoke_barber_account('ba000000-0000-0000-0000-000000006815'), null,
  'revoking the pending invitation returns nothing (no account joined)');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006815'),
  '00000000-0000-0000-0000-0000000068e5'::uuid, 'but the orphan is still offered, so "Quitar acceso" cleans it');

-- After revoking, the session answers nothing --------------------------------------------------

select is(pg_temp.inv('ba000000-0000-0000-0000-000000006817'), 'agenda-68@example.com', 'the owner invites Agenda');
reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000068e7', 'agenda-68@example.com');
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes) values
  ('5e000000-0000-0000-0000-000000006801', 'aaaaaaaa-0000-0000-0000-000000006801', 'Corte', 25000, 30);
insert into public.customers (id, barbershop_id, full_name, email, phone) values
  ('c0000000-0000-0000-0000-000000006801', 'aaaaaaaa-0000-0000-0000-000000006801',
   'Camila Rojas', 'camila-68@example.com', '+573009998877');
-- Tomorrow, and the edges of the days with the phone: -14 and -13, +36 and +37.
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, status) values
  ('a0000000-0000-0000-0000-000000006801', 'aaaaaaaa-0000-0000-0000-000000006801', 'c0000000-0000-0000-0000-000000006801',
   'ba000000-0000-0000-0000-000000006817', pg_temp.at(1, '10:00'), pg_temp.at(1, '10:30'), 25000, 'web', 'confirmed'),
  ('a0000000-0000-0000-0000-000000006802', 'aaaaaaaa-0000-0000-0000-000000006801', 'c0000000-0000-0000-0000-000000006801',
   'ba000000-0000-0000-0000-000000006817', pg_temp.at(-14, '23:30'), pg_temp.at(-13, '00:00'), 25000, 'manual', 'attended'),
  ('a0000000-0000-0000-0000-000000006803', 'aaaaaaaa-0000-0000-0000-000000006801', 'c0000000-0000-0000-0000-000000006801',
   'ba000000-0000-0000-0000-000000006817', pg_temp.at(-13, '00:00'), pg_temp.at(-13, '00:30'), 25000, 'manual', 'attended'),
  ('a0000000-0000-0000-0000-000000006804', 'aaaaaaaa-0000-0000-0000-000000006801', 'c0000000-0000-0000-0000-000000006801',
   'ba000000-0000-0000-0000-000000006817', pg_temp.at(36, '21:30'), pg_temp.at(36, '22:00'), 25000, 'web', 'confirmed'),
  ('a0000000-0000-0000-0000-000000006805', 'aaaaaaaa-0000-0000-0000-000000006801', 'c0000000-0000-0000-0000-000000006801',
   'ba000000-0000-0000-0000-000000006817', pg_temp.at(37, '06:00'), pg_temp.at(37, '06:30'), 25000, 'web', 'confirmed');
insert into public.time_blocks (id, barbershop_id, barber_id, starts_at, ends_at, reason) values
  ('b0000000-0000-0000-0000-000000006801', 'aaaaaaaa-0000-0000-0000-000000006801', 'ba000000-0000-0000-0000-000000006817',
   pg_temp.at(1, '14:00'), pg_temp.at(1, '15:00'), 'Almuerzo'),
  ('b0000000-0000-0000-0000-000000006802', 'aaaaaaaa-0000-0000-0000-000000006801', 'ba000000-0000-0000-0000-000000006817',
   pg_temp.at(1, '16:00'), pg_temp.at(1, '17:00'), 'Permiso');

select pg_temp.as_user('00000000-0000-0000-0000-0000000068e7');
-- Review of 7.6b, point 1: joined, but without the terms, the session
-- reaches nothing yet; my_professional_access does know them, to send them
-- to accept.
select is((public.my_professional_access() ->> 'acceptedTerms'), 'false',
  'my_professional_access knows the professional, who has not accepted the terms');
select is(public.my_agenda((now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date + 1), null,
  'without the terms, my_agenda gives nothing');
select is((select count(*)::integer from public.my_appointment('a0000000-0000-0000-0000-000000006801')), 0,
  'nor my_appointment (nor the customer''s phone)');
select is(pg_temp.hint_of($$select public.mark_my_appointment('a0000000-0000-0000-0000-000000006802', 'no_show')$$),
  'not_professional', 'mark_my_appointment refuses');
select is(pg_temp.hint_of($$select public.create_my_time_block(pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00'), null)$$),
  'not_professional', 'create_my_time_block refuses');
select is(pg_temp.hint_of($$select public.delete_my_time_block('b0000000-0000-0000-0000-000000006801')$$),
  'not_professional', 'delete_my_time_block refuses');
select is(pg_temp.hint_of($$select public.accept_professional_terms('2026-11-15.3')$$), 'no error',
  'they accept the terms');
select is((public.my_professional_access() ->> 'acceptedTerms'), 'true', 'and the flag says so');
select ok(public.my_agenda((now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date + 1) is not null,
  'now my_agenda answers');
select is(pg_temp.hint_of($$select public.create_my_time_block(pg_temp.at(2, '10:00'), pg_temp.at(2, '11:00'), null)$$),
  'no error', 'and create_my_time_block blocks');
select is(
  (select array_agg(customer_phone is not null order by starts_at)
   from (
     select x.* from unnest(array[
       'a0000000-0000-0000-0000-000000006802', 'a0000000-0000-0000-0000-000000006803',
       'a0000000-0000-0000-0000-000000006804', 'a0000000-0000-0000-0000-000000006805'
     ]::uuid[]) a(id)
     cross join lateral public.my_appointment(a.id) x
   ) y),
  array[false, true, true, false],
  'the phone comes from day -13 to day +36: not on -14 (ends at -13''s midnight) nor on +37'
);
select is((select count(*)::integer from public.my_appointment('a0000000-0000-0000-0000-000000006801')), 1,
  'before revoking, Agenda reads their appointment');
select is(pg_temp.hint_of($$select public.delete_my_time_block('b0000000-0000-0000-0000-000000006801')$$), 'no error',
  'and removes their block');

select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.revoke_barber_account('ba000000-0000-0000-0000-000000006817'),
  '00000000-0000-0000-0000-0000000068e7'::uuid, 'the owner revokes Agenda');
select pg_temp.as_user('00000000-0000-0000-0000-0000000068e7');
select is((select count(*)::integer from public.my_appointment('a0000000-0000-0000-0000-000000006801')), 0,
  'after revoking, my_appointment answers nothing');
select is(pg_temp.hint_of($$select public.delete_my_time_block('b0000000-0000-0000-0000-000000006802')$$),
  'not_professional', 'and delete_my_time_block refuses');
reset role;
select is((select count(*)::integer from public.time_blocks where id = 'b0000000-0000-0000-0000-000000006802'), 1,
  'the block is still there');

-- Review of 7.6b, point 3: the old account is never lost --------------------------------------

select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(pg_temp.inv('ba000000-0000-0000-0000-000000006818'), 'cambio-68@example.com', 'the owner invites Cambio');
reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000068e8', 'cambio-68@example.com');
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.revoke_barber_account('ba000000-0000-0000-0000-000000006818'),
  '00000000-0000-0000-0000-0000000068e8'::uuid, 'and takes the access away (Auth then fails to delete it)');
reset role;
update public.barbers set email = 'cambio-otro-68@example.com' where id = 'ba000000-0000-0000-0000-000000006818';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(pg_temp.inv('ba000000-0000-0000-0000-000000006818'), 'revoked_account_pending',
  'with another email, the invitation waits for the old account');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006818'),
  '00000000-0000-0000-0000-0000000068e8'::uuid, 'which is offered for deletion');
reset role;
update public.barber_invitations set revoked_at = null
where barber_id = 'ba000000-0000-0000-0000-000000006818';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006818'),
  '00000000-0000-0000-0000-0000000068e8'::uuid,
  'even if a renewal (from before this migration) cleared revoked_at');

-- Review of 7.6b, point 2: the walls of the orphan branch -------------------------------------

-- (a) S invited Vee and revoked; T invites the same email and Auth's account
-- does not join (its clock far off). It is T's to clean, never S's.
select is(pg_temp.inv('ba000000-0000-0000-0000-000000006819'), 'vee-68@example.com', 'S invites Vee');
select is(public.revoke_barber_account('ba000000-0000-0000-0000-000000006819'), null, 'and revokes it');
select pg_temp.as_user('00000000-0000-0000-0000-000000006802');
select is(pg_temp.inv('ba000000-0000-0000-0000-000000006822'), 'vee-68@example.com', 'T invites the same email');
reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000068e9', 'vee-68@example.com', '-2 minutes');
select is(pg_temp.linked('ba000000-0000-0000-0000-000000006822'), null, 'the account does not join');
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006819'), null,
  'S never gets the orphan of the pending invitation of T');
select pg_temp.as_user('00000000-0000-0000-0000-000000006802');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-000000006822'),
  '00000000-0000-0000-0000-0000000068e9'::uuid, 'T does');

-- (b) An orphan with a profile is someone's: never.
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(pg_temp.inv('ba000000-0000-0000-0000-00000000681b'), 'perfil-68@example.com', 'S invites Perfil');
reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000068ea', 'perfil-68@example.com', '-2 minutes');
insert into public.profiles (id, full_name, active) values ('00000000-0000-0000-0000-0000000068ea', 'Alguien', false);
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-00000000681b'), null,
  'an orphan with a profile row is never offered');

-- (c) Nor one with an identity of another provider.
select is(pg_temp.inv('ba000000-0000-0000-0000-00000000681a'), 'google-68@example.com', 'S invites Google');
reset role;
select pg_temp.invited_by_auth('00000000-0000-0000-0000-0000000068eb', 'google-68@example.com', '-2 minutes');
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('google-68eb', '00000000-0000-0000-0000-0000000068eb', '{}', 'google');
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-00000000681a'), null,
  'an orphan with a Google identity is never offered');
reset role;
delete from auth.identities where user_id = '00000000-0000-0000-0000-0000000068eb';
select pg_temp.as_user('00000000-0000-0000-0000-000000006801');
select is(public.barber_account_to_delete('ba000000-0000-0000-0000-00000000681a'),
  '00000000-0000-0000-0000-0000000068eb'::uuid, 'without it, it is (the wall was the identity)');

select * from finish();
rollback;
