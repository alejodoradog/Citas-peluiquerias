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
-- 7. Terms first (review of 7.6b, point 1): a professional who opened the
--    invitation has a session before accepting the terms of use and the data
--    policy (Ley 1581). private.barber_by_session, which every my_* function
--    uses, now also requires profiles.terms_accepted_at; the new
--    private.linked_barber_by_session is the same without that condition,
--    and only my_professional_access (so the app can send them to accept,
--    with the acceptedTerms flag) and accept_professional_terms use it.
-- 8. invite_barber (review of 7.6b, point 3): while any account this
--    professional had is still in Auth, whatever its email, the answer is
--    revoked_account_pending, so a renewed invitation never makes the next
--    revocation lose it.

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
-- - The revoked account: the invitation of this professional keeps it
--   (revoked_profile_id) until Auth deletes it.
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

  -- The account the owner took away, while the invitation keeps it, even
  -- if a renewal cleared revoked_at since (review of 7.6b, point 3). The
  -- checks below make sure it is nobody's now.
  if invitation.revoked_profile_id is not null then
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
  -- A professional joined to the session, before or after accepting
  -- (section 7): the terms are exactly what they accept here.
  if not exists (select 1 from private.linked_barber_by_session()) then
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

-- 7. Terms first ----------------------------------------------------------------------------------
-- The professional of auth.uid(), as private.barber_by_session was in
-- add_professional_accounts: joined, whether or not they accepted the terms.

create function private.linked_barber_by_session()
returns setof private.barber_access
language sql
stable
security invoker
set search_path = ''
as $$
  select
    br.id,
    br.barbershop_id,
    br.display_name,
    br.active,
    br.uses_barbershop_hours,
    b.name,
    private.barbershop_phase(
      b.subscription_status, b.plan, b.trial_ends_on, b.expires_on,
      (b.created_at at time zone 'America/Bogota')::date
    ) = 'active'
  from public.barbers br
  join public.profiles p on p.id = br.profile_id
  join public.barbershops b on b.id = br.barbershop_id
  where auth.uid() is not null
    and br.profile_id = auth.uid()
    and p.active
    and not p.is_super_admin
    and not br.is_owner
    and b.deleted_at is null
$$;

revoke all on function private.linked_barber_by_session() from public, anon, authenticated;

-- What every my_* function reaches: only once they accepted the terms of use
-- and the data policy. Before that, my_agenda and my_appointment give
-- nothing and the others refuse with not_professional.
create or replace function private.barber_by_session()
returns setof private.barber_access
language sql
stable
security invoker
set search_path = ''
as $$
  select s.*
  from private.linked_barber_by_session() s
  join public.profiles p on p.id = auth.uid()
  where p.terms_accepted_at is not null
$$;

revoke all on function private.barber_by_session() from public, anon, authenticated;

-- As in add_professional_accounts, for a professional joined to the session
-- even before accepting the terms, and with whether they did, so the app
-- sends them to accept them first.
create or replace function public.my_professional_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'barberId', s.barber_id,
    'name', s.display_name,
    'active', s.barber_active,
    'acceptedTerms', p.terms_accepted_at is not null,
    'barbershop', jsonb_build_object(
      'name', s.barbershop_name,
      'slug', b.slug,
      'writable', s.writable
    )
  )
  from private.linked_barber_by_session() s
  join public.barbershops b on b.id = s.barbershop_id
  join public.profiles p on p.id = auth.uid()
$$;

revoke all on function public.my_professional_access() from public, anon, authenticated;
grant execute on function public.my_professional_access() to authenticated;

-- 8. invite_barber: never past an account still in Auth -------------------------------------------
-- As in add_professional_accounts, except for the revoked_account_pending
-- check, which no longer looks at the email.

create or replace function public.invite_barber(p_barber_id uuid)
returns table (status text, email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := auth.uid();
  target record;
  linked record;
  shop_attempts integer;
  account_attempts integer;
begin
  -- The row lock makes two invitations (or an invitation and a revocation)
  -- of the same professional run one after the other.
  select br.id, br.barbershop_id, br.active, br.is_owner, br.profile_id,
         lower(btrim(br.email)) as email
  into target
  from public.barbers br
  where br.id = p_barber_id
    and private.owner_reaches(br.barbershop_id)
  for update of br;
  if not found then
    raise exception 'barber not found'
      using errcode = 'P0002', hint = 'barber_not_found';
  end if;

  if not (target.barbershop_id = any (private.writable_barbershop_ids())) then
    raise exception 'barbershop is read only'
      using errcode = 'insufficient_privilege', hint = 'barbershop_read_only';
  end if;
  if target.is_owner then
    raise exception 'the owner already has an account'
      using errcode = 'P0001', hint = 'barber_is_owner';
  end if;
  if not target.active then
    raise exception 'barber is inactive'
      using errcode = 'P0001', hint = 'barber_inactive';
  end if;
  if coalesce(target.email, '') = '' then
    raise exception 'the professional needs an email'
      using errcode = 'P0001', hint = 'email_required';
  end if;

  if target.profile_id is not null then
    -- Joined already. While the account is not confirmed and has no
    -- password, the invitation can be sent again to the same email; Auth
    -- resends it to the account it already made. These look only at this
    -- professional's own account, never at another email.
    select u.email, u.email_confirmed_at, u.encrypted_password
    into linked
    from auth.users u
    where u.id = target.profile_id;
    if linked.email_confirmed_at is not null or coalesce(linked.encrypted_password, '') <> '' then
      raise exception 'the professional already has an account'
        using errcode = 'P0001', hint = 'already_linked';
    end if;
    if lower(linked.email) is distinct from target.email then
      raise exception 'an invitation to another email is pending'
        using errcode = 'P0001', hint = 'invitation_pending_other_email';
    end if;
  end if;

  -- The attempt counts before the email is looked at: with the limit spent
  -- the answer is invitation_limit, whether the email has an account or not.
  -- 20 a day per barbershop (decision 0010), 40 per account (provisional).
  insert into private.barber_invitation_attempts as s (barbershop_id, day, attempts)
  values (target.barbershop_id, private.today_bogota(), 1)
  on conflict (barbershop_id, day) do update set attempts = s.attempts + 1
  returning s.attempts into shop_attempts;
  insert into private.barber_invitation_attempts_by_account as s (user_id, day, attempts)
  values (caller, private.today_bogota(), 1)
  on conflict (user_id, day) do update set attempts = s.attempts + 1
  returning s.attempts into account_attempts;
  if shop_attempts > 20 or account_attempts > 40 then
    raise exception 'too many invitations today'
      using errcode = 'P0001', hint = 'invitation_limit';
  end if;

  if target.profile_id is null then
    -- Two invitations of the same email (from two barbershops) run one
    -- after the other, so only one of them is pending.
    perform pg_advisory_xact_lock(hashtextextended('invite_barber:' || target.email, 0));

    -- Any account this professional had and the app has not deleted yet,
    -- whatever its email (review of 7.6b, point 3): renewing now would let
    -- the next revocation keep only the new account, and the old one would
    -- stay in Auth forever. The app deletes it (barber_account_to_delete)
    -- and asks again.
    if exists (
      select 1
      from public.barber_invitations i
      join auth.users u on u.id = i.revoked_profile_id
      where i.barbershop_id = target.barbershop_id
        and i.barber_id = target.id
    ) then
      return query select 'revoked_account_pending'::text, null::text;
      return;
    end if;

    -- Decision 0010, point 3: one email, one account. Also an email another
    -- professional has a pending invitation for. The same answer for both,
    -- so the owner does not learn whose it is.
    if exists (select 1 from auth.users u where lower(u.email) = target.email)
      or exists (
        select 1 from public.barber_invitations i
        where i.email = target.email
          and i.accepted_at is null
          and i.revoked_at is null
          and i.expires_at > now()
          and i.barber_id <> target.id
      ) then
      return query select 'email_taken'::text, null::text;
      return;
    end if;
  end if;

  insert into public.barber_invitations as i (
    barbershop_id, barber_id, email, invited_by, created_at, expires_at, accepted_at, revoked_at
  ) values (
    target.barbershop_id, target.id, target.email, caller, now(), now() + interval '7 days', null, null
  )
  on conflict (barbershop_id, barber_id) do update set
    email = excluded.email,
    invited_by = excluded.invited_by,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at,
    -- A professional already joined stays joined: the renewal only resends.
    accepted_at = case when target.profile_id is null then null else i.accepted_at end,
    revoked_at = null;
  -- revoked_profile_id stays: it goes null when the app deletes that account.

  return query select 'invited'::text, target.email;
end;
$$;

revoke all on function public.invite_barber(uuid) from public, anon, authenticated;
grant execute on function public.invite_barber(uuid) to authenticated;
