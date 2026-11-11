-- Task 2.4e, D-61 "Link de reservas" (docs/tareas/2.4-configuracion.md).
--
-- Decision P1 of the founder (2026-11-10): when a barbershop changes its
-- link, the old one stays set aside for it and leads to the new one, so the
-- QR codes and posters already printed keep working. No other barbershop
-- can take it, neither by changing its link nor by signing up.
-- Decision P12 of the founder (2026-11-10): a link stays set aside for 90
-- days (3 months) after it was left; then any barbershop may take it and it
-- no longer leads anywhere. SLUG_SET_ASIDE_DAYS in
-- src/modulos/barberias/dominio/slug.ts is the copy the app reads (the
-- redirect, the availability chip, the sign-up) and the notice of D-61
-- shows; slug.test.ts fails if the two drift apart.
--
-- 1. barbershop_slug_history keeps every link a barbershop left. Only the
--    trigger below writes it: sessions and anon have no write privilege.
-- 2. private.guard_barbershop_slug runs before any insert of a barbershop
--    and any update of its slug, whoever writes (the panel, the sign-up
--    trigger, create_barbershop, the API directly):
--    - a link left 90 days ago or more (P12) leaves the history, whoever
--      left it, and stops counting for anything below;
--    - a link set aside for another barbershop is taken (23505, slug_taken);
--    - decision P11 (confirmed 2026-11-10): a barbershop holds at most 3
--      links retired in the last 30 days (23514, slug_change_limit), so
--      nobody hoards links by changing theirs over and over;
--    - provisional: going back to a link of its own that is still set aside
--      does not wait for the limit (it sets no new link aside: one row
--      leaves the history, one comes in). An own link that is no longer set
--      aside is a new link like any other and waits for it;
--    - going back to a link of its own takes it out of the history.
--    Security definer: it must see the links of other barbershops, which RLS
--    hides from a session, and write the history, which sessions cannot.
-- 3. Races: the trigger takes a transaction lock on every link it reads,
--    frees or sets aside (the old and the new one, in a fixed order so two
--    changes never wait on each other). A sign-up that wants the link
--    another barbershop is leaving waits for that change to commit and then
--    sees the history row; two barbershops that want the same expired link
--    take it one after the other, and the second one hits barbershops_slug_key.
--    Two changes of the same barbershop already run one after the other on
--    its row lock.
--
-- The page behind an old link looks the history up with the anonymous key
-- (anon reads slug, barbershop_id and retired_at, as the links were public
-- on the posters; retired_at lets it skip the links no longer set aside),
-- joined to barbershops for the current slug: no function needed. Expired
-- rows are not swept: they are harmless (nothing reads them as set aside)
-- and leave the history as soon as a barbershop takes the link.

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

grant select (slug, barbershop_id, retired_at) on public.barbershop_slug_history to anon;
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
  -- Decision P12: a link left at or before this instant is no longer set
  -- aside (SLUG_SET_ASIDE_DAYS).
  set_aside_since timestamptz := now() - interval '90 days';
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

  -- P12: whoever left it, an expired link is free again.
  delete from public.barbershop_slug_history h
  where h.slug = new.slug
    and h.retired_at <= set_aside_since;

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

  -- What is left of the new link in the history is the barbershop's own and
  -- still set aside: going back to it does not wait for the limit
  -- (provisional).
  if not exists (
    select 1 from public.barbershop_slug_history h
    where h.slug = new.slug and h.barbershop_id = new.id
  ) and (
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
