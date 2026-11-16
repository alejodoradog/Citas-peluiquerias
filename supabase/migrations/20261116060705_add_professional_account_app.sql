-- Task 7.6b (docs/tareas/7.6-cuentas-profesional.md, decision 0010): what the
-- app needs around the accounts of professionals, and the four points of the
-- independent review of 7.6a (migration add_professional_accounts, already in
-- main, so its functions are replaced here from their current text).
--
-- 1. "mi-agenda" becomes a route (/mi-agenda), so no barbershop can take it
--    as its link. Keep in sync with RESERVED_SLUGS in
--    src/modulos/barberias/dominio/slug.ts (slug.test.ts checks it).
-- 2. barber_account_status: what the owner's "Acceso a su agenda" shows. The
--    owner reads barber_invitations by RLS, but not barbers.profile_id nor
--    whether the account already opened its invitation (auth.users), so this
--    answers it, for a professional of the owner's only.
-- 3. barber_account_to_delete: the one account the app may delete in Auth
--    with the service key, for a professional of the caller's: the account
--    the owner revoked, or the account Auth made for the invitation that did
--    not join (an orphan). Never an owner, a super admin, anyone's
--    professional nor an account someone uses: the service key deletes
--    nothing else, whatever id the app holds.
-- 4. accept_professional_terms: the professional accepts the terms of use
--    and the data policy when they create their password (the session cannot
--    write those columns of profiles), as the owner does at sign-up.
-- 5. revoke_barber_account (review, point 1): an account that is a member of
--    a barbershop is unjoined but never returned, so the app deletes nothing.
-- 6. link_invited_professional (review, point 2): Auth's clock (created_at,
--    invited_at) and Postgres' now() may differ by some milliseconds; the
--    comparisons with the invitation allow one minute. An account made
--    before the invitation is still stopped by invite_barber (email_taken).

-- 1. The route ----------------------------------------------------------------------------------

alter table public.barbershops
  drop constraint barbershops_slug_not_reserved;
alter table public.barbershops
  add constraint barbershops_slug_not_reserved
  check (slug not in (
    'admin', 'api', 'app', 'auth', 'ayuda', 'b', 'c', 'ingresar', 'login', 'mi-agenda',
    'nueva-clave', 'panel', 'privacidad', 'recuperar-clave', 'registro', 'salir', 'soporte',
    'terminos', 'www'
  ));

-- 2. barber_account_status ----------------------------------------------------------------------
-- One row:
-- - 'none': never invited (or the account it had was deleted);
-- - 'invited': an invitation is pending, or the account exists but has not
--   opened it yet (no confirmation, no password);
-- - 'active': the account opened its invitation;
-- - 'revoked': the owner took the access away.
-- sent_at and expires_at are those of the invitation (null for 'none'): the
-- app says until when the email link works. barber_not_found for anything
-- that is not a professional of the caller's barbershops.

create function public.barber_account_status(p_barber_id uuid)
returns table (state text, sent_at timestamptz, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target record;
  invitation record;
  opened boolean;
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

  select i.created_at, i.expires_at, i.accepted_at, i.revoked_at
  into invitation
  from public.barber_invitations i
  where i.barbershop_id = target.barbershop_id
    and i.barber_id = target.id;

  if target.profile_id is not null then
    select u.email_confirmed_at is not null or coalesce(u.encrypted_password, '') <> ''
    into opened
    from auth.users u
    where u.id = target.profile_id;
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

revoke all on function public.barber_account_status(uuid) from public, anon, authenticated;
grant execute on function public.barber_account_status(uuid) to authenticated;

-- 3. barber_account_to_delete -------------------------------------------------------------------
-- Null when there is nothing the app may delete. Only for an owner of the
-- professional (owner_reaches), in any phase of the subscription, as
-- revoke_barber_account.
-- - The revoked account: the invitation of this professional is revoked and
--   keeps it (revoked_profile_id).
-- - The orphan: this professional's invitation never joined (accepted_at is
--   null, pending or revoked), and Auth holds an account with its email that
--   only an invitation makes: invited, without password, not confirmed, by
--   email only, and without profile, so nobody joined or used it. Not while
--   another barbershop has a pending invitation for that email: that one is
--   theirs to clean.
-- In both, never an account with a membership, a super admin or active
-- profile, nor the professional of anyone.

create function public.barber_account_to_delete(p_barber_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  invitation record;
  candidate uuid;
begin
  select i.id, i.email, i.accepted_at, i.revoked_at, i.revoked_profile_id
  into invitation
  from public.barbers br
  join public.barber_invitations i
    on i.barbershop_id = br.barbershop_id and i.barber_id = br.id
  where br.id = p_barber_id
    and private.owner_reaches(br.barbershop_id);
  if not found then
    return null;
  end if;

  if invitation.revoked_at is not null and invitation.revoked_profile_id is not null then
    candidate := invitation.revoked_profile_id;
  elsif invitation.accepted_at is null then
    select u.id into candidate
    from auth.users u
    where lower(u.email) = invitation.email
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
        where o.email = invitation.email
          and o.id <> invitation.id
          and o.accepted_at is null
          and o.revoked_at is null
          and o.expires_at > now()
      )
    limit 1;
  end if;

  if candidate is null
    or exists (select 1 from public.memberships m where m.user_id = candidate)
    or exists (
      select 1 from public.profiles p
      where p.id = candidate and (p.is_super_admin or p.active)
    )
    or exists (select 1 from public.barbers o where o.profile_id = candidate) then
    return null;
  end if;
  return candidate;
end;
$$;

revoke all on function public.barber_account_to_delete(uuid) from public, anon, authenticated;
grant execute on function public.barber_account_to_delete(uuid) to authenticated;

-- 4. accept_professional_terms ------------------------------------------------------------------
-- Only the professional of the session, on their own profile. The version is
-- the date of the text (src/lib/legal/version.ts), as at sign-up.

create function public.accept_professional_terms(p_version text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_version is null or char_length(btrim(p_version)) not between 1 and 20 then
    raise exception 'invalid version'
      using errcode = 'invalid_parameter_value', hint = 'version_invalid';
  end if;
  if not exists (select 1 from private.barber_by_session()) then
    raise exception 'the session is not of a professional'
      using errcode = 'P0001', hint = 'not_professional';
  end if;

  update public.profiles
  set terms_accepted_at = now(),
      terms_version = btrim(p_version)
  where id = auth.uid();
end;
$$;

revoke all on function public.accept_professional_terms(text) from public, anon, authenticated;
grant execute on function public.accept_professional_terms(text) to authenticated;

-- 5. revoke_barber_account: never a member's account ---------------------------------------------
-- As in add_professional_accounts, except that an account that is a member
-- of any barbershop is unjoined but not returned nor kept in the invitation:
-- the app deletes nothing, and invite_barber does not wait for it.

create or replace function public.revoke_barber_account(p_barber_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target record;
  had_invitation boolean;
  is_member boolean;
begin
  select br.id, br.barbershop_id, br.profile_id
  into target
  from public.barbers br
  where br.id = p_barber_id
    and private.owner_reaches(br.barbershop_id)
  for update of br;
  if not found then
    raise exception 'barber not found'
      using errcode = 'P0002', hint = 'barber_not_found';
  end if;

  is_member := target.profile_id is not null
    and exists (select 1 from public.memberships m where m.user_id = target.profile_id);

  update public.barber_invitations i
  set revoked_at = now(),
      revoked_profile_id = case
        when is_member then i.revoked_profile_id
        else coalesce(target.profile_id, i.revoked_profile_id)
      end
  where i.barbershop_id = target.barbershop_id
    and i.barber_id = target.id
    and i.revoked_at is null;
  had_invitation := found;

  if target.profile_id is null then
    if not had_invitation then
      raise exception 'the professional has no account nor invitation'
        using errcode = 'P0001', hint = 'barber_without_account';
    end if;
    return null;
  end if;

  update public.barbers
  set profile_id = null
  where barbershop_id = target.barbershop_id
    and id = target.id;

  if is_member then
    return null;
  end if;

  update public.profiles p
  set active = false
  where p.id = target.profile_id;

  return target.profile_id;
end;
$$;

-- 6. link_invited_professional: one minute between the clocks ------------------------------------
-- As in add_professional_accounts, except for the two comparisons with the
-- invitation's created_at.

create or replace function private.link_invited_professional()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_email text := lower(btrim(coalesce(new.email, '')));
  invitation record;
begin
  -- Only an email account Auth invited, that nobody has taken yet: no
  -- password, not confirmed, not single sign-on nor anonymous, no identity
  -- of another provider, and the email it had when it was invited. A resent
  -- invitation (invited_at changes again) of an account already joined
  -- finds its profile and stops below. The email identity may not exist yet
  -- when this runs; only another provider's is refused.
  if new.invited_at is null
    or invited_email = ''
    or new.email_confirmed_at is not null
    or coalesce(new.encrypted_password, '') <> ''
    or coalesce(new.is_sso_user, false)
    or coalesce(new.is_anonymous, false)
    or coalesce(new.raw_app_meta_data ->> 'provider', 'email') <> 'email'
    or (tg_op = 'UPDATE' and old.invited_at is not distinct from new.invited_at)
    or (tg_op = 'UPDATE' and old.email is distinct from new.email)
    or exists (
      select 1 from auth.identities ai
      where ai.user_id = new.id and ai.provider <> 'email'
    ) then
    return null;
  end if;

  -- An account with a profile is an owner (register_owner_on_signup), a
  -- professional, or one whose access was revoked: never joined.
  if exists (select 1 from public.profiles p where p.id = new.id) then
    return null;
  end if;

  -- Exactly one pending invitation for the email, made before the account
  -- and before Auth invited it (with a minute for the clocks of Auth and
  -- Postgres), not revoked, of an active professional (not the owner) still
  -- without an account and with that same email, in a barbershop that is not
  -- deleted. Locked, so two accounts never take the same one, and a
  -- revocation waits.
  begin
    select i.id, i.barbershop_id, i.barber_id, br.display_name
    into strict invitation
    from public.barber_invitations i
    join public.barbers br on br.barbershop_id = i.barbershop_id and br.id = i.barber_id
    join public.barbershops b on b.id = i.barbershop_id
    where i.email = invited_email
      and i.accepted_at is null
      and i.revoked_at is null
      and i.expires_at > now()
      and i.created_at < new.created_at + interval '1 minute'
      and i.created_at < new.invited_at + interval '1 minute'
      and br.profile_id is null
      and br.active
      and not br.is_owner
      and lower(br.email) = invited_email
      and b.deleted_at is null
    for update of i, br;
  exception
    when no_data_found or too_many_rows then
      return null;
  end;

  insert into public.profiles (id, full_name)
  values (new.id, invitation.display_name);

  -- Decision 0010, question 5: the notice of each booking starts on.
  update public.barbers
  set profile_id = new.id,
      email_notifications = true
  where barbershop_id = invitation.barbershop_id
    and id = invitation.barber_id;

  update public.barber_invitations
  set accepted_at = now()
  where id = invitation.id;

  return null;
end;
$$;

revoke all on function private.link_invited_professional() from public, anon, authenticated;
