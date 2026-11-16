-- Task 7.6c, migration remove_barber_link_add_barber_deletion: the private
-- link of the professional is gone (decision 0010, point 8).
--
-- - The five functions that took a link, and the helper that found the
--   professional behind it, no longer exist: nobody can execute them.
-- - A link_token_hash that worked before opens nothing: no function reads
--   the column any more, and the session of nobody is that professional's.
-- - No session writes the link columns; they stay (a later migration drops
--   them) with a hash nobody knows and the link off.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

-- The functions are gone ------------------------------------------------------------------------

select is(
  array(
    select f from unnest(array[
      'public.barber_agenda(text, date, date)',
      'public.barber_appointment(text, uuid)',
      'public.mark_appointment_by_barber(text, uuid, public.appointment_status)',
      'public.create_time_block_by_barber(text, timestamptz, timestamptz, text)',
      'public.delete_time_block_by_barber(text, uuid)',
      'private.barber_by_link(text)'
    ]) f
    where to_regprocedure(f) is not null
  ),
  '{}'::text[],
  'the five link functions and private.barber_by_link no longer exist'
);
select is(
  array(
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosrc ~ 'link_token_hash'
    order by 1
  ),
  array['delete_barber'],
  'only delete_barber touches link_token_hash, to overwrite it with a hash nobody knows'
);
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and 'p_token_hash' = any (p.proargnames)
      and p.proname not in (
        -- The customer's links (tasks 3.4, 5.3 and "Mis citas"), which stay.
        'cancel_appointment_by_token', 'confirm_appointment_by_token', 'issue_appointment_link',
        'issue_customer_link', 'issue_my_appointment_link', 'managed_appointment',
        'reschedule_appointment_by_token'
      )
  ),
  'no public function takes a token but the customer''s links'
);
select ok(
  not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.barbers'::regclass and tgname = 'guard_barber_link'
  ),
  'the trigger that issued links is gone'
);

-- No session writes the link columns ------------------------------------------------------------

select ok(
  not has_column_privilege('authenticated', 'public.barbers', 'link_token_hash', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.barbers', 'link_token_hash', 'INSERT')
    and not has_column_privilege('authenticated', 'public.barbers', 'link_active', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.barbers', 'link_active', 'INSERT'),
  'no session writes link_token_hash or link_active'
);
select ok(
  not has_column_privilege('anon', 'public.barbers', 'link_token_hash', 'SELECT')
    and not has_column_privilege('authenticated', 'public.barbers', 'link_token_hash', 'SELECT'),
  'nor reads the hash'
);

-- Fixtures: an owner, and a professional whose link worked before (its hash
-- and link_active as the link of task 4.4 left them), with an appointment. ---------------

-- The SQLSTATE a statement raises, or 'no error'.
create function pg_temp.state_of(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return 'no error';
exception when others then
  return sqlstate;
end;
$$;
grant execute on function pg_temp.state_of(text) to anon, authenticated;

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000007001', 'Barbería L', 'barberia-l-70', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days');
insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-000000007001', 'owner-l-70@example.com', '$2a$10$x');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-000000007001', 'Dueña L');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-000000007001', 'aaaaaaaa-0000-0000-0000-000000007001', 'owner');
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, link_active) values
  ('ba000000-0000-0000-0000-000000007011', 'aaaaaaaa-0000-0000-0000-000000007001', 'Viejo',
   encode(sha256(convert_to('link-viejo', 'UTF8')), 'hex'), true);
insert into public.barbers (id, barbershop_id, display_name) values
  ('ba000000-0000-0000-0000-000000007012', 'aaaaaaaa-0000-0000-0000-000000007001', 'Nuevo'),
  ('ba000000-0000-0000-0000-000000007013', 'aaaaaaaa-0000-0000-0000-000000007001', 'Otro Nuevo');

select is(
  (select array_agg(link_active order by id) from public.barbers
   where id in ('ba000000-0000-0000-0000-000000007012', 'ba000000-0000-0000-0000-000000007013')),
  array[false, false],
  'a new professional gets the link off'
);
select ok(
  (select bool_and(private.is_token_hash(link_token_hash)) and count(distinct link_token_hash) = 2
   from public.barbers
   where id in ('ba000000-0000-0000-0000-000000007012', 'ba000000-0000-0000-0000-000000007013')),
  'and a hash of its own that nobody knows'
);

-- The old link opens nothing ----------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is(
  pg_temp.state_of(format($$select public.barber_agenda(%L, current_date, current_date)$$,
    encode(sha256(convert_to('link-viejo', 'UTF8')), 'hex'))),
  '42883',
  'anon, with a hash that worked, finds no function to give it to'
);
select is(
  pg_temp.state_of(format($$select public.mark_appointment_by_barber(%L, gen_random_uuid(), 'attended')$$,
    encode(sha256(convert_to('link-viejo', 'UTF8')), 'hex'))),
  '42883',
  'nor to mark an appointment with it'
);
select is(
  pg_temp.state_of($$select public.my_agenda(current_date, current_date)$$),
  '42501',
  'and without a session, "Mi agenda" is not callable'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000007001", "role": "authenticated"}';
select is(
  pg_temp.state_of(format($$select public.create_time_block_by_barber(%L, now(), now() + interval '1 hour', null)$$,
    encode(sha256(convert_to('link-viejo', 'UTF8')), 'hex'))),
  '42883',
  'a session neither: the functions do not exist for anyone'
);
select is(
  pg_temp.state_of($$update public.barbers set link_active = true, link_token_hash = repeat('a', 64)
    where id = 'ba000000-0000-0000-0000-000000007012'$$),
  '42501',
  'the owner cannot issue a link by hand'
);
select is(
  public.my_agenda((now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date),
  null,
  'and the owner''s own session is not that professional''s'
);

select * from finish();
rollback;
