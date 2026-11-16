-- Task 7.6c (docs/tareas/7.6-cuentas-profesional.md, decision 0010, points 7
-- and 8): deleting a professional, and the end of the private link.
--
-- A. Deleting a professional (point 7, besides "Desactivar").
--    delete_barber, for the owner of that establishment only, in one
--    transaction: refused while the professional has appointments to come;
--    takes the access away (the account is unjoined and its profile turned
--    off, the invitation goes); deletes their services, their own hours and
--    their future blocks; and leaves the row as "Profesional eliminado":
--    without email, photo or notices, inactive, with a link nobody
--    knows, and barbers.deleted_at saying when. The appointments keep
--    pointing at the row, so the past days, the day close and the customers'
--    history stay the same. Never the owner who attends (is_owner).
--    - The accounts left in Auth (the joined one, a revoked one the app has
--      not deleted yet, or the orphan of an invitation) stay in
--      private.deleted_barber_accounts until the app deletes them, and
--      barber_account_to_delete hands them over one at a time, as for
--      "Quitar acceso". The invitation, with its email, is deleted.
--    - delete_barber returns the photo path it cleared, for the app to
--      delete the file in Storage (as with the logo).
--    - A deleted professional is frozen (keep_deleted_barber): no edit, no
--      reactivation, so they never count for the plan's limit again. They
--      take no appointment, block, service or hours by any path
--      (refuse_deleted_barber), and the lock of that check makes a booking
--      and a deletion at the same time run one after the other.
--    - Allowed in every phase of the subscription, as revoke_barber_account
--      and the deletion of a customer (K5 of task 4.3): suspension never
--      holds back the deletion of someone's data.
-- B. The private link (point 8). The five functions by link and
--    private.barber_by_link are dropped; the my_* functions keep the shared
--    bodies (private.*_of). No session writes the link columns any more, the
--    trigger that issued links goes, and every link is turned off. The
--    columns stay until a later migration (decision 0010).
-- C. barber_account_states: the state of the access of every professional
--    of an establishment, in one call, for the owner's list. It and
--    barber_account_status share one body.

-- 1. The mark of a deleted professional ----------------------------------------------------------

alter table public.barbers
  add column deleted_at timestamptz,
  add constraint barbers_deleted_has_no_data check (
    deleted_at is null
    or (
      display_name = 'Profesional eliminado'
      and email is null
      and photo_path is null
      and not email_notifications
      and not active
      and not link_active
      and profile_id is null
      and not is_owner
    )
  );

-- The owner reads it, to leave the deleted out of their lists. Only
-- delete_barber writes it (the column grants of sessions are lists).
grant select (deleted_at) on public.barbers to authenticated;

-- The accounts of deleted professionals the app still has to delete in Auth.
-- When Auth deletes one, its row goes with it. Nobody reads or writes it but
-- delete_barber and barber_account_to_delete.
create table private.deleted_barber_accounts (
  barbershop_id uuid not null,
  barber_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (barbershop_id, barber_id, user_id),
  foreign key (barbershop_id, barber_id)
    references public.barbers (barbershop_id, id) on delete cascade
);

create index deleted_barber_accounts_user_id_idx
  on private.deleted_barber_accounts (user_id);

alter table private.deleted_barber_accounts enable row level security;
revoke all on private.deleted_barber_accounts from public, anon, authenticated;

-- 2. Which accounts the app may delete -------------------------------------------------------------
-- The checks of barber_account_to_delete (add_professional_account_app), now
-- shared with delete_barber.

-- Never a member of an establishment, a super admin, an active profile nor
-- the professional of anyone.
create function private.account_safe_to_delete(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_user_id is not null
    and not exists (select 1 from public.memberships m where m.user_id = p_user_id)
    and not exists (
      select 1 from public.profiles p
      where p.id = p_user_id and (p.is_super_admin or p.active)
    )
    and not exists (select 1 from public.barbers o where o.profile_id = p_user_id)
$$;

-- The orphan of an invitation: an account Auth made for its email that only
-- an invitation makes (invited, without password, not confirmed, by email
-- only) and without profile, so nobody joined or used it. Not while another
-- establishment has a pending invitation for that email: that one is theirs.
create function private.orphan_invited_account(p_invitation_id uuid, p_email text)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = p_email
    and u.invited_at is not null
    and coalesce(u.encrypted_password, '') = ''
    and u.email_confirmed_at is null
    and not coalesce(u.is_sso_user, false)
    and not coalesce(u.is_anonymous, false)
    and coalesce(u.raw_app_meta_data ->> 'provider', 'email') = 'email'
    and not exists (select 1 from auth.identities ai where ai.user_id = u.id and ai.provider <> 'email')
    and not exists (select 1 from public.profiles p where p.id = u.id)
    and not exists (
      select 1 from public.barber_invitations o
      where o.email = p_email
        and o.id <> p_invitation_id
        and o.accepted_at is null
        and o.revoked_at is null
        and o.expires_at > now()
    )
  order by u.id
  limit 1
$$;

revoke all on function private.account_safe_to_delete(uuid) from public, anon, authenticated;
revoke all on function private.orphan_invited_account(uuid, text) from public, anon, authenticated;

-- As in add_professional_account_app, on the shared checks, and for a
-- deleted professional the accounts delete_barber left, one at a time.
create or replace function public.barber_account_to_delete(p_barber_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target record;
  invitation record;
  candidate uuid;
begin
  select br.id, br.barbershop_id, br.deleted_at
  into target
  from public.barbers br
  where br.id = p_barber_id
    and private.owner_reaches(br.barbershop_id);
  if not found then
    return null;
  end if;

  if target.deleted_at is not null then
    select d.user_id into candidate
    from private.deleted_barber_accounts d
    where d.barbershop_id = target.barbershop_id
      and d.barber_id = target.id
      and private.account_safe_to_delete(d.user_id)
    order by d.user_id
    limit 1;
    return candidate;
  end if;

  select i.id, i.email, i.accepted_at, i.revoked_profile_id
  into invitation
  from public.barber_invitations i
  where i.barbershop_id = target.barbershop_id
    and i.barber_id = target.id;
  if not found then
    return null;
  end if;

  -- The account the owner took away, while the invitation keeps it, even
  -- if a renewal cleared revoked_at since (review of 7.6b, point 3).
  if invitation.revoked_profile_id is not null then
    candidate := invitation.revoked_profile_id;
  elsif invitation.accepted_at is null then
    candidate := private.orphan_invited_account(invitation.id, invitation.email);
  end if;

  if not coalesce(private.account_safe_to_delete(candidate), false) then
    return null;
  end if;
  return candidate;
end;
$$;

revoke all on function public.barber_account_to_delete(uuid) from public, anon, authenticated;
grant execute on function public.barber_account_to_delete(uuid) to authenticated;

-- 3. delete_barber ----------------------------------------------------------------------------------
-- Refusals, each with its hint: barber_not_found (not a professional of the
-- caller's establishments), barber_deleted (already), barber_is_owner, and
-- has_upcoming_appointments, with how many in the detail of the error.
-- "To come" is what a customer deletion calls it (K1 of task 4.3): confirmed
-- and not over, so one in progress counts too.

create function public.delete_barber(p_barber_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target record;
  upcoming integer;
  invitation record;
  orphan uuid;
begin
  -- The row lock first: a booking of this professional that is being made
  -- waits for it, or this waits for the booking (refuse_deleted_barber), so
  -- the count below sees it either way. Also orders it with invite_barber
  -- and revoke_barber_account.
  select br.id, br.barbershop_id, br.is_owner, br.profile_id, br.photo_path, br.deleted_at
  into target
  from public.barbers br
  where br.id = p_barber_id
    and private.owner_reaches(br.barbershop_id)
  for update of br;
  if not found then
    raise exception 'barber not found'
      using errcode = 'P0002', hint = 'barber_not_found';
  end if;
  if target.deleted_at is not null then
    raise exception 'the professional was already deleted'
      using errcode = 'P0001', hint = 'barber_deleted';
  end if;
  if target.is_owner then
    raise exception 'the owner who attends is not deleted'
      using errcode = 'P0001', hint = 'barber_is_owner';
  end if;

  select count(*)::integer into upcoming
  from public.appointments a
  where a.barbershop_id = target.barbershop_id
    and a.barber_id = target.id
    and a.status = 'confirmed'
    and a.ends_at > now();
  if upcoming > 0 then
    raise exception 'the professional has % appointments to come', upcoming
      using errcode = 'P0001', hint = 'has_upcoming_appointments', detail = upcoming::text;
  end if;

  -- The access, as revoke_barber_account: the joined account is unjoined
  -- (below) and its profile turned off, unless it is a member somewhere (then
  -- the app deletes nothing).
  if target.profile_id is not null
    and not exists (select 1 from public.memberships m where m.user_id = target.profile_id) then
    update public.profiles p set active = false where p.id = target.profile_id;
    insert into private.deleted_barber_accounts (barbershop_id, barber_id, user_id)
    values (target.barbershop_id, target.id, target.profile_id)
    on conflict do nothing;
  end if;

  -- The invitation goes, with its email. What it still points at in Auth
  -- (an account revoked before, or the orphan of an invitation that never
  -- joined) stays for the app to delete.
  select i.id, i.email, i.accepted_at, i.revoked_profile_id
  into invitation
  from public.barber_invitations i
  where i.barbershop_id = target.barbershop_id
    and i.barber_id = target.id
  for update;
  if found then
    if private.account_safe_to_delete(invitation.revoked_profile_id) then
      insert into private.deleted_barber_accounts (barbershop_id, barber_id, user_id)
      values (target.barbershop_id, target.id, invitation.revoked_profile_id)
      on conflict do nothing;
    end if;
    if invitation.accepted_at is null then
      orphan := private.orphan_invited_account(invitation.id, invitation.email);
      if private.account_safe_to_delete(orphan) then
        insert into private.deleted_barber_accounts (barbershop_id, barber_id, user_id)
        values (target.barbershop_id, target.id, orphan)
        on conflict do nothing;
      end if;
    end if;
    delete from public.barber_invitations i where i.id = invitation.id;
  end if;

  -- What they had: the services they did, their own hours and their blocks
  -- still to come. Their past blocks stay with the past days.
  delete from public.barber_services s
  where s.barbershop_id = target.barbershop_id and s.barber_id = target.id;
  delete from public.barber_schedules s
  where s.barbershop_id = target.barbershop_id and s.barber_id = target.id;
  -- require_writable_block lets these through in any phase while it is on.
  -- No session can set it (PostgREST exposes no set_config), and it is off
  -- again right after.
  perform set_config('yapoin.deleting_barber', 'on', true);
  delete from public.time_blocks t
  where t.barbershop_id = target.barbershop_id
    and t.barber_id = target.id
    and t.ends_at > now();
  perform set_config('yapoin.deleting_barber', '', true);

  update public.barbers
  set display_name = 'Profesional eliminado',
      email = null,
      photo_path = null,
      email_notifications = false,
      active = false,
      uses_barbershop_hours = true,
      profile_id = null,
      link_active = false,
      -- A link nobody knows, as for a new professional.
      link_token_hash = encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'),
      deleted_at = now()
  where barbershop_id = target.barbershop_id
    and id = target.id;

  return target.photo_path;
end;
$$;

revoke all on function public.delete_barber(uuid) from public, anon, authenticated;
grant execute on function public.delete_barber(uuid) to authenticated;

-- 4. A deleted professional stays as they are --------------------------------------------------------

create function private.keep_deleted_barber()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'the professional was deleted'
    using errcode = 'P0001', hint = 'barber_deleted';
end;
$$;

revoke all on function private.keep_deleted_barber() from public, anon, authenticated;

create trigger keep_deleted_barber
  before update on public.barbers
  for each row
  when (old.deleted_at is not null)
  execute function private.keep_deleted_barber();

-- Nothing new for a deleted professional, by any path: no appointment (nor
-- one moved to them, nor one brought back to come), no block, no service and
-- no hours. The key share lock waits for a deletion in progress (its FOR
-- UPDATE), and then reads the row as it was left.
create function private.refuse_deleted_barber()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted timestamptz;
begin
  if new.barber_id is null then
    return new;
  end if;
  -- Nested: a record of another table has no status to read.
  if tg_table_name = 'appointments' and tg_op = 'UPDATE' then
    if new.barber_id is not distinct from old.barber_id
      and not (new.status = 'confirmed' and new.ends_at > now()) then
      return new;
    end if;
  end if;

  select br.deleted_at into deleted
  from public.barbers br
  where br.barbershop_id = new.barbershop_id
    and br.id = new.barber_id
  for key share;
  if deleted is not null then
    raise exception 'the professional was deleted'
      using errcode = 'P0001', hint = 'barber_deleted';
  end if;
  return new;
end;
$$;

revoke all on function private.refuse_deleted_barber() from public, anon, authenticated;

create trigger refuse_deleted_barber
  before insert or update of barber_id, status, starts_at, ends_at on public.appointments
  for each row execute function private.refuse_deleted_barber();
create trigger refuse_deleted_barber
  before insert on public.time_blocks
  for each row execute function private.refuse_deleted_barber();
create trigger refuse_deleted_barber
  before insert on public.barber_services
  for each row execute function private.refuse_deleted_barber();
create trigger refuse_deleted_barber
  before insert on public.barber_schedules
  for each row execute function private.refuse_deleted_barber();

-- 5. Deleting works in every phase ---------------------------------------------------------------------
-- As in add_professional_accounts, plus the deletion itself: only
-- delete_barber can set deleted_at (no session writes it), and
-- barbers_deleted_has_no_data says what the row becomes.

create or replace function private.limit_barber_updates_when_read_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_actor() <> 'staff'
    or private.phase_of(new.barbershop_id) in ('active', 'awaiting_first_payment')
    or (old.deleted_at is null and new.deleted_at is not null) then
    return new;
  end if;

  if (to_jsonb(new) - 'link_active' - 'active' - 'updated_at' - 'profile_id')
      = (to_jsonb(old) - 'link_active' - 'active' - 'updated_at' - 'profile_id')
    and new.link_active <= old.link_active
    and new.active <= old.active
    and (new.profile_id is null or new.profile_id = old.profile_id) then
    return new;
  end if;

  raise exception 'barbershop is read only'
    using errcode = 'insufficient_privilege', hint = 'barbershop_read_only';
end;
$$;

-- As in read_only_when_suspended, plus the future blocks delete_barber
-- removes.
create or replace function private.require_writable_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shop uuid := case when tg_op = 'DELETE' then old.barbershop_id else new.barbershop_id end;
begin
  -- Section 8 of read_only_when_suspended: delete_barbershop; and
  -- delete_barber (add_barber_deletion).
  if tg_op = 'DELETE' and (
    current_setting('yapoin.deleting_barbershop', true) = 'on'
    or current_setting('yapoin.deleting_barber', true) = 'on'
  ) then
    return old;
  end if;
  if private.current_actor() = 'staff'
    and coalesce(private.phase_of(shop), '') not in ('active', 'awaiting_first_payment') then
    raise exception 'barbershop is read only'
      using errcode = 'insufficient_privilege', hint = 'barbershop_read_only';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- 6. The private link goes -------------------------------------------------------------------------------

drop function public.barber_agenda(text, date, date);
drop function public.barber_appointment(text, uuid);
drop function public.mark_appointment_by_barber(text, uuid, public.appointment_status);
drop function public.create_time_block_by_barber(text, timestamptz, timestamptz, text);
drop function public.delete_time_block_by_barber(text, uuid);
drop function private.barber_by_link(text);

-- Nothing issues a link any more: the trigger that stamped it goes.
drop trigger guard_barber_link on public.barbers;
drop function private.guard_barber_link();

-- No session writes the link columns. A new professional gets a hash nobody
-- knows and an inactive link from the defaults.
revoke insert (link_token_hash, link_active) on public.barbers from authenticated;
revoke update (link_token_hash, link_active) on public.barbers from authenticated;
alter table public.barbers
  alter column link_token_hash
    set default encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'),
  alter column link_active set default false;

-- Every link is off. A later migration drops the columns (decision 0010).
update public.barbers set link_active = false where link_active;

-- Only the my_* functions set an actor now: the 'barber' of the link is gone.
create or replace function private.current_actor()
returns public.event_actor
language sql
stable
set search_path = ''
as $$
  select case
    -- Task 7.6: a professional with their own session, through the my_*
    -- functions only (no session can set yapoin.actor).
    when auth.uid() is not null and current_setting('yapoin.actor', true) = 'barber_session' then 'barber'
    when auth.uid() is not null then 'staff'
    when current_setting('yapoin.actor', true) = 'customer' then 'customer'
    else 'system'
  end::public.event_actor
$$;

-- The wizard, as in add_barbershop_setup, without the link columns (the
-- defaults give them): security invoker, so the column grants above apply.
create or replace function public.complete_barbershop_setup(
  p_barbershop_id uuid,
  p_hours jsonb,
  p_services jsonb,
  p_barbers jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  service_ids jsonb := '{}';
  item jsonb;
  barber_position bigint;
  new_id uuid;
  owner_flag boolean;
begin
  if not (p_barbershop_id = any (private.member_barbershop_ids())) then
    raise exception 'not a member of this barbershop'
      using errcode = 'insufficient_privilege', hint = 'not_member';
  end if;

  -- The mark takes the row lock: two taps on "Terminar" run one after the
  -- other, and the second one finds the mark of the first. A failure later
  -- rolls the mark back with everything else.
  update public.barbershops set setup_completed_at = now()
  where id = p_barbershop_id and setup_completed_at is null;
  if not found then
    raise exception 'the barbershop is already set up'
      using errcode = 'check_violation', hint = 'setup_done';
  end if;

  if jsonb_typeof(p_services) is distinct from 'array'
     or jsonb_array_length(p_services) not between 1 and 30 then
    raise exception 'between 1 and 30 services'
      using errcode = 'check_violation', hint = 'services_required';
  end if;
  if jsonb_typeof(p_barbers) is distinct from 'array'
     or jsonb_array_length(p_barbers) > 50 then
    raise exception 'at most 50 barbers'
      using errcode = 'check_violation', hint = 'too_many_barbers';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_services) s
    where jsonb_typeof(s -> 'key') is distinct from 'string' or btrim(s ->> 'key') = ''
  ) or (
    select count(distinct s ->> 'key') from jsonb_array_elements(p_services) s
  ) <> jsonb_array_length(p_services) then
    raise exception 'each service needs its own key'
      using errcode = 'check_violation', hint = 'setup_invalid';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_services) s
    group by lower(btrim(s ->> 'name'))
    having count(*) > 1
  ) then
    raise exception 'two services share a name'
      using errcode = 'check_violation', hint = 'service_name_taken';
  end if;

  -- A barbershop without hours gets the ones of the setup: without them no
  -- one could book.
  if not exists (select 1 from public.barbershop_hours h where h.barbershop_id = p_barbershop_id) then
    if jsonb_typeof(p_hours) is distinct from 'array' or jsonb_array_length(p_hours) = 0 then
      raise exception 'opening hours required'
        using errcode = 'check_violation', hint = 'hours_required';
    end if;
    insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
    select p_barbershop_id, (h ->> 'weekday')::smallint, (h ->> 'start_time')::time, (h ->> 'end_time')::time
    from jsonb_array_elements(p_hours) h;
  end if;

  for item in select value from jsonb_array_elements(p_services) loop
    insert into public.services (barbershop_id, name, price_cop, duration_minutes)
    values (
      p_barbershop_id,
      btrim(item ->> 'name'),
      (item ->> 'price_cop')::integer,
      (item ->> 'duration_minutes')::integer
    )
    returning id into new_id;
    service_ids := service_ids || jsonb_build_object(item ->> 'key', new_id);
  end loop;

  for item, barber_position in
    select value, ordinality from jsonb_array_elements(p_barbers) with ordinality
  loop
    if jsonb_typeof(item -> 'service_keys') is distinct from 'array'
       or jsonb_array_length(item -> 'service_keys')
          not between 1 and jsonb_array_length(p_services) then
      raise exception 'each barber does at least one service'
        using errcode = 'check_violation', hint = 'barber_services_required';
    end if;
    owner_flag := coalesce((item ->> 'is_owner')::boolean, false);

    insert into public.barbers (barbershop_id, display_name, email, is_owner, sort_order)
    values (
      p_barbershop_id,
      btrim(item ->> 'display_name'),
      nullif(lower(btrim(item ->> 'email')), ''),
      owner_flag,
      barber_position - 1
    )
    returning id into new_id;

    if exists (
      select 1 from jsonb_array_elements_text(item -> 'service_keys') k
      where not service_ids ? k
    ) then
      raise exception 'unknown service in the setup'
        using errcode = 'check_violation', hint = 'unknown_service';
    end if;
    insert into public.barber_services (barbershop_id, barber_id, service_id)
    select distinct p_barbershop_id, new_id, (service_ids ->> k)::uuid
    from jsonb_array_elements_text(item -> 'service_keys') k;
  end loop;
end;
$$;

revoke all on function public.complete_barbershop_setup(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.complete_barbershop_setup(uuid, jsonb, jsonb, jsonb) to authenticated;

-- 7. The access of every professional, for the owner's list ---------------------------------------------
-- The body of barber_account_status (add_professional_account_app), for one
-- professional already found:
-- - 'none': never invited (or the account it had was deleted);
-- - 'invited': an invitation is pending, or the account exists but has not
--   opened it yet (no confirmation, no password);
-- - 'active': the account opened its invitation;
-- - 'revoked': the owner took the access away.
-- Security invoker: only the security definer functions below call it.

create function private.barber_account_state(p_barbershop_id uuid, p_barber_id uuid, p_profile_id uuid)
returns table (state text, sent_at timestamptz, expires_at timestamptz)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  invitation record;
  opened boolean;
begin
  select i.created_at, i.expires_at, i.accepted_at, i.revoked_at
  into invitation
  from public.barber_invitations i
  where i.barbershop_id = p_barbershop_id
    and i.barber_id = p_barber_id;

  if p_profile_id is not null then
    select u.email_confirmed_at is not null or coalesce(u.encrypted_password, '') <> ''
    into opened
    from auth.users u
    where u.id = p_profile_id;
    return query select
      case when coalesce(opened, false) then 'active' else 'invited' end,
      invitation.created_at,
      invitation.expires_at;
    return;
  end if;

  if invitation.created_at is null then
    return query select 'none'::text, null::timestamptz, null::timestamptz;
  elsif invitation.revoked_at is not null then
    return query select 'revoked'::text, invitation.created_at, invitation.expires_at;
  elsif invitation.accepted_at is null then
    return query select 'invited'::text, invitation.created_at, invitation.expires_at;
  else
    -- Joined once, and the account is gone: as never invited.
    return query select 'none'::text, null::timestamptz, null::timestamptz;
  end if;
end;
$$;

revoke all on function private.barber_account_state(uuid, uuid, uuid) from public, anon, authenticated;

-- As in add_professional_account_app, on the shared body.
create or replace function public.barber_account_status(p_barber_id uuid)
returns table (state text, sent_at timestamptz, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select br.id, br.barbershop_id, br.profile_id
  into target
  from public.barbers br
  where br.id = p_barber_id
    and private.owner_reaches(br.barbershop_id);
  if not found then
    raise exception 'barber not found'
      using errcode = 'P0002', hint = 'barber_not_found';
  end if;

  return query
  select s.state, s.sent_at, s.expires_at
  from private.barber_account_state(target.barbershop_id, target.id, target.profile_id) s;
end;
$$;

-- One row per professional of the establishment who can have an account:
-- not the owner who attends, not a deleted one. Nothing for an
-- establishment the caller does not own.
create function public.barber_account_states(p_barbershop_id uuid)
returns table (barber_id uuid, state text, sent_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select br.id, s.state, s.sent_at, s.expires_at
  from public.barbers br
  cross join lateral private.barber_account_state(br.barbershop_id, br.id, br.profile_id) s
  where private.owner_reaches(p_barbershop_id)
    and br.barbershop_id = p_barbershop_id
    and not br.is_owner
    and br.deleted_at is null
$$;

revoke all on function public.barber_account_status(uuid) from public, anon, authenticated;
revoke all on function public.barber_account_states(uuid) from public, anon, authenticated;
grant execute on function public.barber_account_status(uuid) to authenticated;
grant execute on function public.barber_account_states(uuid) to authenticated;
