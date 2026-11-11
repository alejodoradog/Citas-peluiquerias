-- Task 2.4e, migration add_slug_history (D-61, Link de reservas): a link a
-- barbershop leaves stays set aside for it and leads to the new one; no other
-- barbershop takes it, by changing its link or by signing up; going back to
-- an own link is allowed; at most 3 links retired in 30 days (P11); only the
-- trigger writes the history.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(42);

-- The code and the hint of the error a statement raises, or 'ok'. Run as the
-- table owner: the trigger behaves the same for every role (security
-- definer), and pgTAP's throws_ok cannot read the hint.
create function pg_temp.error_of(statement text)
returns text
language plpgsql
as $$
declare
  state text;
  the_hint text;
begin
  execute statement;
  return 'ok';
exception when others then
  get stacked diagnostics state = returned_sqlstate, the_hint = pg_exception_hint;
  return state || ' ' || coalesce(nullif(the_hint, ''), '-');
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com');
insert into public.barbershops (id, name, slug, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Sede A', 'sede-a', current_date + 10, current_date + 10),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Sede B', 'sede-b', current_date + 10, current_date + 10),
  ('cccccccc-0000-0000-0000-000000000000', 'Sede C', 'sede-c', current_date + 10, current_date + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233'),
  ('00000000-0000-0000-0000-00000000000b', 'Dueño B', '+573001112244');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'owner');

-- Structure and privileges ------------------------------------------------------------------

select has_table('public', 'barbershop_slug_history', 'barbershop_slug_history exists');
select col_is_pk('public', 'barbershop_slug_history', 'slug', 'a link is set aside once, for one barbershop');
select ok(
  has_column_privilege('anon', 'public.barbershop_slug_history', 'slug', 'SELECT')
  and has_column_privilege('anon', 'public.barbershop_slug_history', 'barbershop_id', 'SELECT')
  and not has_column_privilege('anon', 'public.barbershop_slug_history', 'retired_at', 'SELECT'),
  'anon reads where an old link leads, not when it was left'
);
select ok(
  not has_any_column_privilege('anon', 'public.barbershop_slug_history', 'INSERT')
  and not has_any_column_privilege('anon', 'public.barbershop_slug_history', 'UPDATE')
  and not has_table_privilege('anon', 'public.barbershop_slug_history', 'DELETE')
  and not has_any_column_privilege('authenticated', 'public.barbershop_slug_history', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.barbershop_slug_history', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.barbershop_slug_history', 'DELETE'),
  'nobody writes the history directly'
);
select ok(
  not has_function_privilege('anon', 'private.guard_barbershop_slug()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.guard_barbershop_slug()', 'EXECUTE'),
  'nobody runs the trigger function by hand'
);

-- Owner A changes the link ------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$update public.barbershops set slug = 'sede-a-norte' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'the owner changes the link'
);
select is(
  (select slug from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'sede-a-norte',
  'the new link is the current one'
);
select is(
  (select barbershop_id from public.barbershop_slug_history where slug = 'sede-a'),
  'aaaaaaaa-0000-0000-0000-000000000000'::uuid,
  'the old link stays set aside for the barbershop, which reads it'
);
select lives_ok(
  $$update public.barbershops set slug = 'sede-a-norte' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'saving the same link again'
);
select is(
  (select count(*) from public.barbershop_slug_history where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  1::bigint,
  'sets nothing aside'
);
select lives_ok(
  $$update public.barbershops set slug = 'sede-a' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'the owner goes back to the old link'
);
select is(
  array(
    select slug from public.barbershop_slug_history
    where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000' order by slug
  ),
  array['sede-a-norte'],
  'going back takes it out of the history and sets aside the one it left'
);
select throws_ok(
  $$insert into public.barbershop_slug_history (slug, barbershop_id)
    values ('acaparado', 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  '42501', null, 'a session cannot set a link aside by hand'
);
select throws_ok(
  $$update public.barbershop_slug_history set barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '42501', null, 'nor change who a link is set aside for'
);
select throws_ok(
  $$delete from public.barbershop_slug_history$$,
  '42501', null, 'nor free one'
);

-- Another barbershop: RLS hides its row, nothing changes (checked below).
update public.barbershops set slug = 'robada' where id = 'bbbbbbbb-0000-0000-0000-000000000000';

-- A link set aside for one barbershop is taken for every other one.
select throws_ok(
  $$select public.create_barbershop('Otra sede', 'sede-a-norte')$$,
  '23505', null, 'a second barbershop of the same owner cannot take it either: it leads to the first one'
);

-- Owner B ---------------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select throws_ok(
  $$update public.barbershops set slug = 'sede-a-norte' where id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  '23505', null, 'another barbershop cannot take a link set aside for A'
);
select throws_ok(
  $$update public.barbershops set slug = 'sede-a' where id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  '23505', null, 'nor the link A uses now'
);
select throws_ok(
  $$select public.create_barbershop('Sede B Norte', 'sede-a-norte')$$,
  '23505', null, 'nor open a new barbershop on it'
);
select lives_ok(
  $$update public.barbershops set slug = 'sede-b-centro' where id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'B changes to a free link'
);
select is(
  array(select slug from public.barbershop_slug_history order by slug),
  array['sede-b'],
  'B reads only its own history'
);

-- The booking page, without a session ---------------------------------------------------------

set local role anon;
set local request.jwt.claims to '';

select is(
  (select barbershop_id from public.barbershop_slug_history where slug = 'sede-a-norte'),
  'aaaaaaaa-0000-0000-0000-000000000000'::uuid,
  'anon reads which barbershop an old link belongs to'
);
select is(
  (
    select b.slug from public.barbershop_slug_history h
    join public.barbershops b on b.id = h.barbershop_id
    where h.slug = 'sede-a-norte'
  ),
  'sede-a',
  'and its current link, to send the visitor there'
);
select is(
  (select count(*) from public.barbershop_slug_history where slug = 'no-existe'),
  0::bigint,
  'a link never used leads nowhere'
);
select throws_ok(
  $$select retired_at from public.barbershop_slug_history$$,
  '42501', null, 'anon does not read when a link was left'
);
select throws_ok(
  $$insert into public.barbershop_slug_history (slug, barbershop_id)
    values ('acaparado', 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  '42501', null, 'anon cannot set a link aside'
);
select throws_ok(
  $$update public.barbershops set slug = 'de-anon' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  '42501', null, 'anon cannot change a link'
);

-- Whoever writes: the hints, the sign-up and the limit ------------------------------------------

reset role;

select is(
  pg_temp.error_of($$update public.barbershops set slug = 'sede-a-norte' where id = 'cccccccc-0000-0000-0000-000000000000'$$),
  '23505 slug_taken',
  'the refusal says the link is taken'
);
select is(
  pg_temp.error_of($$insert into public.barbershops (name, slug, trial_ends_on, expires_on)
    values ('Nueva', 'sede-b', current_date + 10, current_date + 10)$$),
  '23505 slug_taken',
  'a new barbershop cannot take a link set aside'
);
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
      '00000000-0000-0000-0000-0000000000c1', 'nuevo@example.com',
      '{"owner_name": "Nuevo", "barbershop_name": "Sede B", "barbershop_slug": "sede-b", "phone": "+573001112255"}')$$,
  '23505', null, 'a sign-up on a link set aside fails as a whole'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  0::bigint,
  'and leaves no owner behind'
);
select throws_ok(
  $$insert into public.barbershop_slug_history (slug, barbershop_id)
    values ('No Vale', 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  '23514', null, 'the history only holds links in the format of a link'
);
select is(
  (select slug from public.barbershops where id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  'sede-b-centro',
  'the owner of A never changed the link of B'
);

-- A holds sede-a-norte; two more links left today make 3 in 30 days.
insert into public.barbershop_slug_history (slug, barbershop_id) values
  ('sede-a-vieja-1', 'aaaaaaaa-0000-0000-0000-000000000000'),
  ('sede-a-vieja-2', 'aaaaaaaa-0000-0000-0000-000000000000');

select is(
  pg_temp.error_of($$update public.barbershops set slug = 'sede-a-nueva' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$),
  '23514 slug_change_limit',
  'a fourth link in 30 days is refused'
);
select is(
  pg_temp.error_of($$update public.barbershops set slug = 'sede-a-norte' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$),
  '23514 slug_change_limit',
  'going back to an own link also waits for the limit (P11, provisional)'
);
select is(
  (select slug from public.barbershops where id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'sede-a',
  'the link stays as it was'
);

update public.barbershop_slug_history
set retired_at = now() - interval '31 days'
where slug in ('sede-a-vieja-1', 'sede-a-vieja-2');

select lives_ok(
  $$update public.barbershops set slug = 'sede-a-nueva' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$,
  'links left more than 30 days ago do not count'
);
select is(
  array(
    select slug from public.barbershop_slug_history
    where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000000' order by slug
  ),
  array['sede-a', 'sede-a-norte', 'sede-a-vieja-1', 'sede-a-vieja-2'],
  'and stay set aside'
);

-- Deleting a barbershop frees its links.
update public.barbershops set slug = 'sede-c-2' where id = 'cccccccc-0000-0000-0000-000000000000';
select is(
  (select barbershop_id from public.barbershop_slug_history where slug = 'sede-c'),
  'cccccccc-0000-0000-0000-000000000000'::uuid,
  'C left its link'
);
delete from public.barbershops where id = 'cccccccc-0000-0000-0000-000000000000';
select is(
  (select count(*) from public.barbershop_slug_history where barbershop_id = 'cccccccc-0000-0000-0000-000000000000'),
  0::bigint,
  'deleting the barbershop deletes its history'
);
select lives_ok(
  $$insert into public.barbershops (name, slug, trial_ends_on, expires_on)
    values ('Otra C', 'sede-c', current_date + 10, current_date + 10)$$,
  'and its old link is free again'
);

-- A barbershop that signs up on a free link works as before.
select lives_ok(
  $$insert into public.barbershops (name, slug, trial_ends_on, expires_on)
    values ('Libre', 'sede-libre', current_date + 10, current_date + 10)$$,
  'a new barbershop on a free link'
);

select * from finish();
rollback;
