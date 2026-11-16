-- Task 7.2 (docs/tareas/7.2-registro.md): the kind of business an
-- establishment is. Yapoin is no longer only for barbershops (task 7.1), and
-- the platform panel counts establishments by kind (task 7.12).
--
-- - The owner chooses it at sign-up: the form sends it in the metadata of the
--   account, and a trigger after on_auth_user_created keeps it in the
--   barbershop, as record_terms_acceptance does with the terms.
-- - A barbershop created later by the same owner (create_barbershop) takes
--   the kind of their first one.
-- - Both columns are nullable: accounts made by hand and the ones from before
--   this task have no kind.
-- - Nobody changes it from the browser: authenticated has no UPDATE grant on
--   these columns, and anon cannot read them.

create type public.business_type as enum (
  'barbershop',
  'beauty_salon',
  'veterinary',
  'psychology',
  'dentistry',
  'other'
);

alter table public.barbershops
  add column business_type public.business_type,
  -- What the owner wrote when they chose "other".
  add column business_type_other text,
  add constraint barbershops_business_type_other_only_for_other check (
    business_type_other is null
    or (
      business_type = 'other'
      and business_type_other = btrim(business_type_other)
      and char_length(business_type_other) between 1 and 60
    )
  );

-- After on_auth_user_created (triggers run in name order), which made the
-- barbershop and the membership. The metadata comes from the browser: an
-- unknown kind is ignored, and the text is trimmed and cut.
create function private.record_business_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  chosen text := meta ->> 'business_type';
  other text := nullif(btrim(left(btrim(coalesce(meta ->> 'business_type_other', '')), 60)), '');
begin
  if chosen is null
    or not (chosen = any (enum_range(null::public.business_type)::text[])) then
    return null;
  end if;

  update public.barbershops b
  set business_type = chosen::public.business_type,
      business_type_other = case when chosen = 'other' then other end
  from public.memberships m
  where m.user_id = new.id
    and m.role = 'owner'
    and m.barbershop_id = b.id;
  return null;
end;
$$;

revoke all on function private.record_business_type() from public;

create trigger record_business_type
  after insert on auth.users
  for each row execute function private.record_business_type();

-- A barbershop the owner creates later is the same kind of business as
-- their first one. On the membership, because that is what ties the new
-- barbershop to its owner; at sign-up there is no other barbershop yet, so
-- nothing happens here and record_business_type sets it.
create function private.inherit_business_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.barbershops b
  set business_type = first.business_type,
      business_type_other = first.business_type_other
  from (
    select o.business_type, o.business_type_other
    from public.memberships m
    join public.barbershops o on o.id = m.barbershop_id
    where m.user_id = new.user_id
      and m.role = 'owner'
      and o.id <> new.barbershop_id
      and o.business_type is not null
    order by o.created_at, o.id
    limit 1
  ) first
  where b.id = new.barbershop_id
    and b.business_type is null;
  return null;
end;
$$;

revoke all on function private.inherit_business_type() from public;

create trigger inherit_business_type
  after insert on public.memberships
  for each row
  when (new.role = 'owner')
  execute function private.inherit_business_type();
