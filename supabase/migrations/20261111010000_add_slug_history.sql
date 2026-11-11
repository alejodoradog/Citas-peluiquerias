-- Task 2.4e, D-61 "Link de reservas" (docs/tareas/2.4-configuracion.md).
--
-- Decision P1 of the founder (2026-11-10): when a barbershop changes its
-- link, the old one stays set aside for it and leads to the new one, so the
-- QR codes and posters already printed keep working. No other barbershop
-- can take it, neither by changing its link nor by signing up.
--
-- 1. barbershop_slug_history keeps every link a barbershop left. Only the
--    trigger below writes it: sessions and anon have no write privilege.
-- 2. private.guard_barbershop_slug runs before any insert of a barbershop
--    and any update of its slug, whoever writes (the panel, the sign-up
--    trigger, create_barbershop, the API directly):
--    - a link set aside for another barbershop is taken (23505, slug_taken);
--    - provisional decision P11: a barbershop holds at most 3 links retired
--      in the last 30 days (23514, slug_change_limit), so nobody hoards
--      links by changing theirs over and over;
--    - going back to a link of its own takes it out of the history.
--    Security definer: it must see the links of other barbershops, which RLS
--    hides from a session, and write the history, which sessions cannot.
-- 3. Races: the trigger takes a transaction lock on every link it reads or
--    sets aside (the old and the new one, in a fixed order so two changes
--    never wait on each other). A sign-up that wants the link another
--    barbershop is leaving waits for that change to commit and then sees
--    the history row. Two changes of the same barbershop already run one
--    after the other on its row lock.
--
-- The page behind an old link looks the history up with the anonymous key
-- (anon reads slug and barbershop_id, as the links were public on the
-- posters), joined to barbershops for the current slug: no function needed.

create table public.barbershop_slug_history (
  slug text primary key
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  retired_at timestamptz not null default now()
);

-- The limit counts a barbershop's recent rows; the cascade and the policy
-- look rows up by barbershop.
create index barbershop_slug_history_barbershop_id_idx
  on public.barbershop_slug_history (barbershop_id, retired_at);

alter table public.barbershop_slug_history enable row level security;

grant select (slug, barbershop_id) on public.barbershop_slug_history to anon;
grant select on public.barbershop_slug_history to authenticated;

create policy public_read on public.barbershop_slug_history
  for select to anon using (true);
create policy member_read on public.barbershop_slug_history
  for select to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));
create policy super_admin_read on public.barbershop_slug_history
  for select to authenticated
  using ((select private.is_super_admin()));

create function private.guard_barbershop_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_key integer := hashtext('barbershop_slug:' || new.slug);
  old_key integer;
begin
  if tg_op = 'UPDATE' then
    if new.slug = old.slug then
      return new;
    end if;
    old_key := hashtext('barbershop_slug:' || old.slug);
    -- Lowest key first: two changes that cross each other's links wait in
    -- line instead of deadlocking.
    perform pg_advisory_xact_lock(least(new_key, old_key));
    perform pg_advisory_xact_lock(greatest(new_key, old_key));
  else
    perform pg_advisory_xact_lock(new_key);
  end if;

  if exists (
    select 1 from public.barbershop_slug_history h
    where h.slug = new.slug and h.barbershop_id <> new.id
  ) then
    raise exception 'this link is set aside for another barbershop'
      using errcode = 'unique_violation', hint = 'slug_taken';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  if (
    select count(*) from public.barbershop_slug_history h
    where h.barbershop_id = new.id
      and h.retired_at > now() - interval '30 days'
  ) >= 3 then
    raise exception 'too many link changes in the last 30 days'
      using errcode = 'check_violation', hint = 'slug_change_limit';
  end if;

  delete from public.barbershop_slug_history h
  where h.slug = new.slug and h.barbershop_id = new.id;

  insert into public.barbershop_slug_history (slug, barbershop_id)
  values (old.slug, new.id)
  on conflict (slug) do update set retired_at = now()
    where public.barbershop_slug_history.barbershop_id = excluded.barbershop_id;

  return new;
end;
$$;

revoke all on function private.guard_barbershop_slug() from public;

create trigger guard_barbershop_slug
  before insert or update of slug on public.barbershops
  for each row execute function private.guard_barbershop_slug();
