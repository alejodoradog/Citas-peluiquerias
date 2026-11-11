-- Task 2.6b (docs/tareas/2.6-sedes.md): at most 4 sedes per account, and
-- "Eliminar sede".
--
-- Decisions of the founder (2026-11-10):
-- - An account holds at most 4 sedes (MAX_BARBERSHOPS_PER_ACCOUNT in
--   src/modulos/barberias/dominio/barbershop-limit.ts; its test fails if the
--   two copies drift apart).
-- - A sede can be deleted only while the account keeps another one, and not
--   while it has upcoming appointments: those are cancelled first.
--
-- Provisional decisions E1-E3 of task 2.6b:
-- - E1. The barbershops row stays (its subscription_payments are accounting,
--   and they reference it on delete restrict, decision 0006): it is marked
--   deleted_at and disappears for its owner, anon and the panel. The super
--   admin still reads it with its payments.
-- - E2. Every operational row of the sede is really deleted (Ley 1581):
--   customers, appointments and their lines, events and notifications, time
--   blocks, opening hours, holidays, barbers, services and the owner's
--   membership. Without the membership, the owner reaches nothing of it
--   through RLS (private.member_barbershop_ids).
-- - E3. Its link is set aside for 90 days like any link a barbershop leaves
--   (the QR codes already printed must not lead to another barbershop), but
--   leads nowhere: anon no longer reads the barbershop, so the history row
--   joins to nothing. The row takes a random link of its own,
--   eliminada-<random hex>, which nobody can claim beforehand. Leaving the
--   link this way does not count for the 3 changes in 30 days.
--
-- Images (provisional decision E4): Storage refuses deletes made with SQL,
-- so the app removes the sede's folder through the Storage API after the
-- deletion. By then the owner has no membership, so deleted_by gives the
-- former owner read and delete (never insert) on that folder only.
--
-- Races: create_barbershop and delete_barbershop lock the caller's profile
-- row first, so two creations cannot both pass the limit and two deletions
-- cannot both see "another sede" and leave the account with none. The
-- deletion then locks the barbershop row: a booking that inserts an
-- appointment waits for it (its foreign key needs a key share lock on the
-- row) and then fails on the deleted barbers; one that committed earlier is
-- seen by the check that follows the lock.

-- 1. The mark --------------------------------------------------------------------

alter table public.barbershops
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  -- The account that deleted it may be deleted later; the mark stays.
  add constraint barbershops_deleted_by_needs_deleted_at
    check (deleted_by is null or deleted_at is not null);

-- The storage policies look barbershops up by who deleted them.
create index barbershops_deleted_by_idx
  on public.barbershops (deleted_by)
  where deleted_by is not null;

-- authenticated reads every column through its table grant (RLS narrows the
-- rows); nobody gets insert or update on the mark: only delete_barbershop
-- (security definer) writes it. anon gets no privilege on it: its policy
-- reads it, which needs no column privilege.

-- 2. Policies: a deleted barbershop is gone for anon and for its members -------------

drop policy public_read on public.barbershops;
create policy public_read on public.barbershops
  for select to anon
  using (deleted_at is null);

-- Its memberships are deleted with it; the condition is a second wall.
drop policy member_read on public.barbershops;
create policy member_read on public.barbershops
  for select to authenticated
  using (
    id = any ((select private.member_barbershop_ids())::uuid[])
    and deleted_at is null
  );
drop policy member_update on public.barbershops;
create policy member_update on public.barbershops
  for update to authenticated
  using (
    id = any ((select private.member_barbershop_ids())::uuid[])
    and deleted_at is null
  )
  with check (
    id = any ((select private.member_barbershop_ids())::uuid[])
    and deleted_at is null
  );

-- 3. Leaving the link on deletion does not count as a change -------------------------
-- Same function as migration add_slug_history, plus the deletion branch and
-- the refusal to change the link of a deleted barbershop.

create or replace function private.guard_barbershop_slug()
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
    -- Task 2.6b: the link of a deleted barbershop never changes again.
    if old.deleted_at is not null then
      raise exception 'the barbershop was deleted'
        using errcode = 'check_violation', hint = 'barbershop_deleted';
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

  -- Task 2.6b (E3): the barbershop is being deleted (delete_barbershop sets
  -- the mark and the new link in one update). Its link is set aside like
  -- any other, but the owner did not choose to change it, so it does not
  -- count for P11.
  if new.deleted_at is null then
    -- P11: every change counts, going back to an own link too.
    if (
      select count(*) from public.barbershop_slug_changes c
      where c.barbershop_id = new.id
        and c.changed_at > now() - interval '30 days'
    ) >= 3 then
      raise exception 'too many link changes in the last 30 days'
        using errcode = 'check_violation', hint = 'slug_change_limit';
    end if;

    insert into public.barbershop_slug_changes (barbershop_id) values (new.id);
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

-- 4. create_barbershop: at most 4 sedes --------------------------------------------------
-- Same function as migration make_create_barbershop_idempotent, plus the
-- profile lock, the limit and the refusal to hand back a deleted sede.

create or replace function public.create_barbershop(
  p_name text,
  p_slug text,
  p_whatsapp_phone text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_phone text;
  company_trial_ends_on date;
  new_barbershop_id uuid;
  earlier record;
begin
  -- Only an active owner of at least one barbershop; never a super admin.
  -- The row lock makes two creations (or a creation and a deletion) of the
  -- same account run one after the other, so the limit below holds.
  select p.phone into caller_phone
  from public.profiles p
  where p.id = caller
    and p.active
    and not p.is_super_admin
  for update;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- The same request again: the barbershop it already created, even when
  -- the account is now at the limit. The lock makes a simultaneous second
  -- call wait for the first to commit or roll back; the select after it sees
  -- whichever happened.
  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtext('create_barbershop:' || p_request_id::text));
    select c.user_id, c.barbershop_id, b.deleted_at into earlier
    from private.barbershop_creations c
    join public.barbershops b on b.id = c.barbershop_id
    where c.request_id = p_request_id;
    if found then
      if earlier.user_id is distinct from caller then
        raise exception 'not allowed' using errcode = 'insufficient_privilege';
      end if;
      -- Task 2.6b: the sede it created was deleted since. The request was
      -- already served; it never creates another one, nor hands back a
      -- sede that is gone.
      if earlier.deleted_at is not null then
        raise exception 'the barbershop this request created was deleted'
          using errcode = 'no_data_found', hint = 'barbershop_deleted';
      end if;
      return earlier.barbershop_id;
    end if;
  end if;

  -- The company trial: the one of the owner's first barbershop. Every sede
  -- copies it, so deleting the first one does not change it.
  select b.trial_ends_on into company_trial_ends_on
  from public.memberships m
  join public.barbershops b on b.id = m.barbershop_id
  where m.user_id = caller
    and m.role = 'owner'
  order by b.created_at, b.id
  limit 1;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- Founder (2026-11-10): at most 4 sedes per account
  -- (MAX_BARBERSHOPS_PER_ACCOUNT). Deleted sedes have no membership.
  if (
    select count(*) from public.memberships m
    join public.barbershops b on b.id = m.barbershop_id
    where m.user_id = caller
      and m.role = 'owner'
      and b.deleted_at is null
  ) >= 4 then
    raise exception 'an account holds at most 4 barbershops'
      using errcode = 'check_violation', hint = 'barbershop_limit';
  end if;

  if p_whatsapp_phone is not null and p_whatsapp_phone !~ '^\+573[0-9]{9}$' then
    raise exception 'invalid phone'
      using errcode = 'check_violation', hint = 'phone_invalid';
  end if;

  insert into public.barbershops (name, slug, whatsapp_phone, trial_ends_on, expires_on)
  values (
    btrim(p_name),
    p_slug,
    coalesce(p_whatsapp_phone, caller_phone),
    company_trial_ends_on,
    company_trial_ends_on
  )
  returning id into new_barbershop_id;

  insert into public.memberships (user_id, barbershop_id, role)
  values (caller, new_barbershop_id, 'owner');

  if p_request_id is not null then
    insert into private.barbershop_creations (request_id, user_id, barbershop_id)
    values (p_request_id, caller, new_barbershop_id);
  end if;

  return new_barbershop_id;
end;
$$;

revoke all on function public.create_barbershop(text, text, text, uuid) from public;
grant execute on function public.create_barbershop(text, text, text, uuid) to authenticated;

-- 5. delete_barbershop --------------------------------------------------------------------

create function public.delete_barbershop(p_barbershop_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  -- An active owner, never a super admin. The profile lock first, as in
  -- create_barbershop: two deletions of the same account run one after the
  -- other, so the second one sees the first and never deletes the last sede.
  perform 1
  from public.profiles p
  where p.id = caller
    and p.active
    and not p.is_super_admin
  for update;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- The owner of this sede. A deleted sede has no membership left, so
  -- deleting it again is refused here too.
  if not exists (
    select 1 from public.memberships m
    where m.user_id = caller
      and m.barbershop_id = p_barbershop_id
      and m.role = 'owner'
  ) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- The row lock: bookings of this sede wait for the deletion (see the
  -- header), and the checks below see any that committed before it.
  perform 1
  from public.barbershops b
  where b.id = p_barbershop_id
    and b.deleted_at is null
  for update;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- Founder: only while the account keeps another sede.
  if not exists (
    select 1 from public.memberships m
    join public.barbershops b on b.id = m.barbershop_id
    where m.user_id = caller
      and m.role = 'owner'
      and m.barbershop_id <> p_barbershop_id
      and b.deleted_at is null
  ) then
    raise exception 'the account needs another barbershop'
      using errcode = 'check_violation', hint = 'last_barbershop';
  end if;

  -- Founder: not while customers expect to be served. Provisional: an
  -- appointment still going on (it ends later) counts too.
  if exists (
    select 1 from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.status = 'confirmed'
      and a.ends_at > now()
  ) then
    raise exception 'the barbershop has upcoming appointments'
      using errcode = 'check_violation', hint = 'has_upcoming_appointments';
  end if;

  -- E2, children before parents (every foreign key is on delete restrict).
  -- Deleting the lines logs service_removed events, so the events go after.
  delete from public.appointment_services where barbershop_id = p_barbershop_id;
  delete from public.appointment_events where barbershop_id = p_barbershop_id;
  delete from public.notifications where barbershop_id = p_barbershop_id;
  delete from public.appointments where barbershop_id = p_barbershop_id;
  delete from public.customers where barbershop_id = p_barbershop_id;
  delete from public.time_blocks where barbershop_id = p_barbershop_id;
  delete from public.barber_services where barbershop_id = p_barbershop_id;
  delete from public.barber_schedules where barbershop_id = p_barbershop_id;
  delete from public.barbers where barbershop_id = p_barbershop_id;
  delete from public.services where barbershop_id = p_barbershop_id;
  delete from public.barbershop_hours where barbershop_id = p_barbershop_id;
  delete from public.holiday_openings where barbershop_id = p_barbershop_id;
  delete from public.memberships where barbershop_id = p_barbershop_id;

  -- E1 and E3: the mark, a random link of its own (guard_barbershop_slug
  -- sets the old one aside without counting it), and nothing personal or
  -- public left on the row: the WhatsApp, the deposit account and the
  -- images, which the app removes from Storage next.
  update public.barbershops
  set deleted_at = now(),
      deleted_by = caller,
      slug = 'eliminada-' || replace(gen_random_uuid()::text, '-', ''),
      whatsapp_phone = null,
      deposit_method = null,
      deposit_account = null,
      logo_path = null,
      cover_photo_path = null
  where id = p_barbershop_id;
end;
$$;

revoke all on function public.delete_barbershop(uuid) from public;
grant execute on function public.delete_barbershop(uuid) to authenticated;

-- 6. The former owner removes the deleted sede's images (E4) -----------------------------

-- The barbershops the caller deleted, while their profile is active.
-- Policies call it as (select ...), so it runs once per statement.
create function private.deleted_barbershop_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(b.id), '{}')
  from public.barbershops b
  join public.profiles p on p.id = b.deleted_by
  where b.deleted_by = auth.uid()
    and b.deleted_at is not null
    and p.active
$$;

revoke all on function private.deleted_barbershop_ids() from public;
grant execute on function private.deleted_barbershop_ids() to authenticated;

-- Read (the Storage API lists the folder and returns what it deletes) and
-- delete; no insert: nothing new goes into a deleted sede.
create policy images_former_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = any ((select private.deleted_barbershop_ids())::text[])
  );

create policy images_former_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = any ((select private.deleted_barbershop_ids())::text[])
  );
