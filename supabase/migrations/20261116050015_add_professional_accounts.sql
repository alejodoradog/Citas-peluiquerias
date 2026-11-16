-- Task 7.6a (docs/tareas/7.6-cuentas-profesional.md, decision 0010): accounts
-- of professionals, by invitation of the owner.
--
-- The professional has an account but is NOT a member of the barbershop:
-- memberships, private.member_barbershop_ids() and every policy stay as they
-- are, so a professional's session reads no table. Their account is tied to
-- their row (barbers.profile_id) and everything they do goes through the
-- security definer functions of this migration, which look at auth.uid().
--
-- 1. barbers.profile_id: the account of the professional; never the owner
--    who attends (is_owner), who already has their own account.
-- 2. barber_invitations: one per professional, 7 days, read by the owner;
--    nobody writes it directly. private.barber_invitation_sends counts the
--    invitations of a barbershop per Bogotá day (at most 20).
-- 3. invite_barber: the owner asks; the app sends the email with the service
--    key (task 7.6b). Auth creates the account there.
-- 4. on_auth_user_invited joins the account. Auth inserts the user and sets
--    invited_at with an UPDATE after the insert (checked against the local
--    Auth), so the trigger looks at both. It joins only an account Auth
--    invited, with no password and no confirmation yet, created after the
--    invitation, and with exactly one pending invitation for its email.
--    "Invited" alone is not enough: an account made by the normal sign-up
--    with the invited email (and a password someone else chose) becomes
--    invited too when Auth invites that email afterwards.
-- 5. private.barber_by_session: the professional of auth.uid().
-- 6. The five functions of the link (add_barber_agenda, block_only_open_time)
--    move their bodies to private.*_of, which take the professional already
--    resolved. The link functions and the new my_* call them: one rule set.
--    my_appointment also brings the customer's phone (decision 0010, point 6).
-- 7. my_professional_access: whether the session is of a professional.
--
-- private.current_actor: a session function sets yapoin.actor to
-- 'barber_session', so the history records 'barber' (with auth.uid() as the
-- account) and not 'staff', as by the link.
--
-- Errors carry a hint the app maps: those of the link (link_invalid,
-- read_only, not_yours, ...), not_professional for a session that is not of a
-- professional, and for invite_barber: barber_not_found, barbershop_read_only,
-- barber_is_owner, barber_inactive, email_required, email_taken,
-- already_linked, invitation_pending_other_email, invitation_limit.

-- 0. Who acts -----------------------------------------------------------------------------------

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
    when current_setting('yapoin.actor', true) = 'barber' then 'barber'
    else 'system'
  end::public.event_actor
$$;

-- 1. barbers.profile_id -------------------------------------------------------------------------

-- Unique: one professional per account. On delete set null: task 7.6c
-- deletes the account and keeps the row as "Profesional eliminado".
alter table public.barbers
  add column profile_id uuid unique references public.profiles (id) on delete set null,
  add constraint barbers_owner_without_profile check (not (is_owner and profile_id is not null));

-- No session reads or writes it: the column grants of barbers are lists,
-- and this column is in none of them. Only on_auth_user_invited sets it.

-- 2. Invitations --------------------------------------------------------------------------------

create table public.barber_invitations (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  barber_id uuid not null,
  email text not null check (private.is_email(email) and email = lower(email)),
  invited_by uuid references public.profiles (id) on delete set null,
  -- When the invitation (or its last renewal) was made.
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- When the account was joined to the professional.
  accepted_at timestamptz,
  -- One invitation per professional; it is also the index of the foreign
  -- key and of the policy (barbershop_id first).
  unique (barbershop_id, barber_id),
  foreign key (barbershop_id, barber_id)
    references public.barbers (barbershop_id, id) on delete cascade,
  constraint barber_invitations_expiry check (expires_at > created_at)
);

-- The trigger looks for the pending invitations of an email.
create index barber_invitations_pending_email_idx
  on public.barber_invitations (email)
  where accepted_at is null;
create index barber_invitations_invited_by_idx
  on public.barber_invitations (invited_by);

alter table public.barber_invitations enable row level security;
revoke all on public.barber_invitations from public, anon, authenticated;
grant select on public.barber_invitations to authenticated;

create policy member_read on public.barber_invitations
  for select to authenticated
  using (barbershop_id = any ((select private.member_barbershop_ids())::uuid[]));
create policy super_admin_read on public.barber_invitations
  for select to authenticated
  using ((select private.is_super_admin()));

-- Invitations sent per barbershop and Bogotá day (decision 0010, question 7).
-- Only invite_barber reads or writes it; no session role has any privilege,
-- and RLS is on without policies as a second wall.
create table private.barber_invitation_sends (
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  day date not null,
  sent integer not null check (sent >= 0),
  primary key (barbershop_id, day)
);

alter table private.barber_invitation_sends enable row level security;
revoke all on private.barber_invitation_sends from public, anon, authenticated;

-- 3. invite_barber ------------------------------------------------------------------------------

create function public.invite_barber(p_barber_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target record;
  linked record;
  sent_today integer;
begin
  -- The row lock makes two invitations of the same professional run one
  -- after the other.
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
    -- resends it to the account it already made.
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
  else
    -- Two invitations of the same email (from two barbershops) run one
    -- after the other, so only one of them is pending.
    perform pg_advisory_xact_lock(hashtextextended('invite_barber:' || target.email, 0));

    -- Decision 0010, point 3: one email, one account. Also an email another
    -- professional has a pending invitation for. The same hint for both, so
    -- the owner does not learn whose it is.
    if exists (select 1 from auth.users u where lower(u.email) = target.email)
      or exists (
        select 1 from public.barber_invitations i
        where i.email = target.email
          and i.accepted_at is null
          and i.expires_at > now()
          and i.barber_id <> target.id
      ) then
      raise exception 'the email is taken'
        using errcode = 'P0001', hint = 'email_taken';
    end if;
  end if;

  -- At most 20 a day per barbershop, renewals included: each one is an email.
  insert into private.barber_invitation_sends as s (barbershop_id, day, sent)
  values (target.barbershop_id, private.today_bogota(), 1)
  on conflict (barbershop_id, day) do update set sent = s.sent + 1
  returning s.sent into sent_today;
  if sent_today > 20 then
    raise exception 'at most 20 invitations a day'
      using errcode = 'P0001', hint = 'invitation_limit';
  end if;

  insert into public.barber_invitations as i (
    barbershop_id, barber_id, email, invited_by, created_at, expires_at, accepted_at
  ) values (
    target.barbershop_id, target.id, target.email, auth.uid(), now(), now() + interval '7 days', null
  )
  on conflict (barbershop_id, barber_id) do update set
    email = excluded.email,
    invited_by = excluded.invited_by,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at,
    -- A professional already joined stays joined: the renewal only resends.
    accepted_at = case when target.profile_id is null then null else i.accepted_at end;

  return target.email;
end;
$$;

revoke all on function public.invite_barber(uuid) from public, anon, authenticated;
grant execute on function public.invite_barber(uuid) to authenticated;

-- 4. Joining the invited account ----------------------------------------------------------------

create function private.link_invited_professional()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_email text := lower(btrim(coalesce(new.email, '')));
  invitation record;
begin
  -- Only an account Auth invited, that nobody has taken yet: no password,
  -- not confirmed. A resent invitation (invited_at changes again) of an
  -- account already joined finds its profile and stops below.
  if new.invited_at is null
    or invited_email = ''
    or new.email_confirmed_at is not null
    or coalesce(new.encrypted_password, '') <> ''
    or (tg_op = 'UPDATE' and old.invited_at is not distinct from new.invited_at) then
    return null;
  end if;

  -- An account with a profile is an owner (register_owner_on_signup) or
  -- already a professional: never joined.
  if exists (select 1 from public.profiles p where p.id = new.id) then
    return null;
  end if;

  -- Exactly one pending invitation for the email, made before the account,
  -- of an active professional (not the owner) still without an account and
  -- with that same email, in a barbershop that is not deleted. Locked, so
  -- two accounts never take the same one.
  begin
    select i.id, i.barbershop_id, i.barber_id, br.display_name
    into strict invitation
    from public.barber_invitations i
    join public.barbers br on br.barbershop_id = i.barbershop_id and br.id = i.barber_id
    join public.barbershops b on b.id = i.barbershop_id
    where i.email = invited_email
      and i.accepted_at is null
      and i.expires_at > now()
      and i.created_at <= new.created_at
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

-- After on_auth_user_created (triggers run in name order): an owner's
-- sign-up makes its profile first, and this one then leaves it alone.
create trigger on_auth_user_invited
  after insert or update of invited_at on auth.users
  for each row execute function private.link_invited_professional();

-- 5. The professional of the session ------------------------------------------------------------

-- What private.barber_by_link returns, as a type the shared bodies take.
create type private.barber_access as (
  barber_id uuid,
  barbershop_id uuid,
  display_name text,
  barber_active boolean,
  uses_barbershop_hours boolean,
  barbershop_name text,
  writable boolean
);

-- As barber_by_link: an inactive professional still reaches their agenda;
-- a deleted barbershop gives nothing. Also an active account that is not a
-- super admin, and never the owner who attends.
create function private.barber_by_session()
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

revoke all on function private.barber_by_session() from public, anon, authenticated;

-- 6. The shared bodies ---------------------------------------------------------------------------
-- Security invoker and without grants: only the security definer functions
-- below call them, with the professional already resolved.

create function private.barber_agenda_of(p_barber private.barber_access, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  range_start timestamptz;
  range_end timestamptz;
begin
  -- At most 7 days, inside the days the barber can open (decision B5: a
  -- week back to 30 days ahead), widened to the whole weeks of B-02 that
  -- touch them: never the barber's whole history.
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 6
    or p_from < private.today_bogota() - 13
    or p_to > private.today_bogota() + 36 then
    raise exception 'at most 7 days, near today'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;
  range_start := p_from::timestamp at time zone 'America/Bogota';
  range_end := (p_to + 1)::timestamp at time zone 'America/Bogota';

  return jsonb_build_object(
    'barber', jsonb_build_object(
      'id', p_barber.barber_id,
      'name', p_barber.display_name,
      'active', p_barber.barber_active
    ),
    'barbershop', jsonb_build_object(
      'name', p_barber.barbershop_name,
      'writable', p_barber.writable
    ),
    'schedule', jsonb_build_object(
      'usesBarbershopHours', p_barber.uses_barbershop_hours,
      'shifts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'weekday', s.weekday,
          'start', to_char(s.start_time, 'HH24:MI'),
          'end', to_char(s.end_time, 'HH24:MI')
        ) order by s.weekday, s.start_time)
        from public.barber_schedules s
        where s.barbershop_id = p_barber.barbershop_id
          and s.barber_id = p_barber.barber_id
      ), '[]'::jsonb)
    ),
    'shopHours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', h.weekday,
        'start', to_char(h.start_time, 'HH24:MI'),
        'end', to_char(h.end_time, 'HH24:MI')
      ) order by h.weekday, h.start_time)
      from public.barbershop_hours h
      where h.barbershop_id = p_barber.barbershop_id
    ), '[]'::jsonb),
    'holidayOpenings', coalesce((
      select jsonb_agg(to_char(o.holiday_date, 'YYYY-MM-DD') order by o.holiday_date)
      from public.holiday_openings o
      where o.barbershop_id = p_barber.barbershop_id
        and o.holiday_date between p_from and p_to
    ), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'startsAt', a.starts_at,
        'endsAt', a.ends_at,
        'status', a.status,
        'source', a.source,
        'createdAt', a.created_at,
        'customerName', private.short_customer_name(c.full_name),
        'services', coalesce((
          select jsonb_agg(sv.name order by l.position)
          from public.appointment_services l
          join public.services sv
            on sv.barbershop_id = l.barbershop_id and sv.id = l.service_id
          where l.barbershop_id = a.barbershop_id
            and l.appointment_id = a.id
        ), '[]'::jsonb)
      ) order by a.starts_at)
      from public.appointments a
      join public.customers c
        on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
      where a.barbershop_id = p_barber.barbershop_id
        and a.barber_id = p_barber.barber_id
        and a.status in ('confirmed', 'attended', 'no_show')
        and a.starts_at < range_end
        and a.ends_at > range_start
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'own', t.barber_id is not null,
        'startsAt', t.starts_at,
        'endsAt', t.ends_at,
        'reason', t.reason
      ) order by t.starts_at)
      from public.time_blocks t
      where t.barbershop_id = p_barber.barbershop_id
        and (t.barber_id = p_barber.barber_id or t.barber_id is null)
        and t.starts_at < range_end
        and t.ends_at > range_start
    ), '[]'::jsonb)
  );
end;
$$;

-- B-03, with the customer's phone: only my_appointment returns it.
create function private.barber_appointment_of(p_barber private.barber_access, p_appointment_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  source public.appointment_source,
  created_at timestamptz,
  customer_name text,
  customer_phone text,
  service_names text[],
  service_minutes integer[],
  visits integer,
  no_shows integer,
  writable boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id,
    a.starts_at,
    a.ends_at,
    a.status,
    a.source,
    a.created_at,
    private.short_customer_name(c.full_name),
    c.phone,
    array(
      select sv.name
      from public.appointment_services l
      join public.services sv on sv.barbershop_id = l.barbershop_id and sv.id = l.service_id
      where l.barbershop_id = a.barbershop_id and l.appointment_id = a.id
      order by l.position
    ),
    array(
      select l.duration_minutes
      from public.appointment_services l
      where l.barbershop_id = a.barbershop_id and l.appointment_id = a.id
      order by l.position
    ),
    (select count(*)::integer from public.appointments v
     where v.barbershop_id = a.barbershop_id and v.customer_id = a.customer_id and v.status = 'attended'),
    (select count(*)::integer from public.appointments v
     where v.barbershop_id = a.barbershop_id and v.customer_id = a.customer_id and v.status = 'no_show'),
    p_barber.writable
  from public.appointments a
  join public.customers c
    on c.barbershop_id = a.barbershop_id and c.id = a.customer_id
  where p_barber.barber_id is not null
    and a.barbershop_id = p_barber.barbershop_id
    and a.barber_id = p_barber.barber_id
    and a.id = p_appointment_id
    -- As the agenda: a cancelled appointment is no longer the barber's.
    and a.status in ('confirmed', 'attended', 'no_show')
$$;

create function private.mark_appointment_of(
  p_barber private.barber_access,
  p_appointment_id uuid,
  p_status public.appointment_status
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  found_appointment public.appointments;
begin
  if p_status is null or p_status not in ('attended', 'no_show') then
    raise exception 'the link marks attended or no_show only'
      using errcode = 'invalid_parameter_value', hint = 'status_invalid';
  end if;

  select a.* into found_appointment
  from public.appointments a
  where a.id = p_appointment_id
    and a.barbershop_id = p_barber.barbershop_id
    and a.barber_id = p_barber.barber_id
  for update;
  if not found then
    raise exception 'not an appointment of this barber'
      using errcode = 'P0001', hint = 'not_yours';
  end if;

  if found_appointment.status <> 'confirmed' then
    raise exception 'only a confirmed appointment is marked'
      using errcode = 'P0001', hint = 'not_confirmed';
  end if;

  if found_appointment.starts_at > now() then
    raise exception 'the appointment has not started'
      using errcode = 'P0001', hint = 'too_early';
  end if;
  -- Decision B5: a week back, for what the barber forgot to mark. Older
  -- appointments are the owner's to mark.
  if found_appointment.starts_at
    < (private.today_bogota() - 7)::timestamp at time zone 'America/Bogota' then
    raise exception 'too old to mark from the link'
      using errcode = 'P0001', hint = 'not_yours';
  end if;

  update public.appointments
  set status = p_status
  where id = found_appointment.id;
end;
$$;

-- The rules of block_only_open_time (task 7.4), unchanged.
create function private.create_time_block_of(
  p_barber private.barber_access,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  block_day date;
  new_id uuid;
begin
  if not p_barber.writable then
    raise exception 'the barbershop is read only'
      using errcode = 'P0001', hint = 'read_only';
  end if;
  if not p_barber.barber_active then
    raise exception 'barber is inactive'
      using errcode = 'P0001', hint = 'barber_inactive';
  end if;

  -- The reasons of B-04, as the owner's agenda shows them; "Otro" is none.
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at
    or (p_reason is not null and p_reason not in ('Almuerzo', 'Permiso', 'Diligencia')) then
    raise exception 'invalid block'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;
  -- From the current quarter hour: the barber can block the rest of it.
  if p_starts_at < date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00+00') then
    raise exception 'the block starts in the past'
      using errcode = 'P0001', hint = 'too_early';
  end if;
  block_day := (p_starts_at at time zone 'America/Bogota')::date;
  if p_starts_at <> date_bin('15 minutes', p_starts_at, timestamptz '2000-01-01 00:00+00')
    or p_ends_at <> date_bin('15 minutes', p_ends_at, timestamptz '2000-01-01 00:00+00')
    or p_ends_at > (block_day + 1)::timestamp at time zone 'America/Bogota'
    or block_day > private.today_bogota() + 30 then
    raise exception 'one day, in steps of 15 minutes, up to 30 days ahead'
      using errcode = 'invalid_parameter_value', hint = 'range_invalid';
  end if;

  -- The same lock as a public booking of that barbershop and Bogotá day, so
  -- the two see each other. The day before too, in order, because a
  -- booking takes the lock of the day it starts and may run past midnight.
  perform pg_advisory_xact_lock(
    hashtextextended('book_appointment:' || p_barber.barbershop_id::text || ':' || (block_day - 1)::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('book_appointment:' || p_barber.barbershop_id::text || ':' || block_day::text, 0)
  );

  -- Task 7.4: only time that is open can be blocked. A holiday the
  -- barbershop does not open, a day the barber does not work and the hours
  -- the barbershop already closed are closed without a block; one more
  -- would only say it twice. The block may run past the open time (a whole
  -- day, 0:00 to 24:00): it is refused when no quarter hour of it is open.
  if (
    private.is_colombian_holiday(block_day)
    and not exists (
      select 1
      from public.holiday_openings o
      where o.barbershop_id = p_barber.barbershop_id
        and o.holiday_date = block_day
    )
  ) or not exists (
    with open_spans as materialized (
      select s.starts_at, s.ends_at
      from private.barber_open_spans(p_barber.barbershop_id, p_barber.barber_id, block_day) s
    )
    select 1
    from generate_series(p_starts_at, p_ends_at - interval '15 minutes', interval '15 minutes') as quarter(at)
    where exists (
      select 1 from open_spans s
      where quarter.at >= s.starts_at and quarter.at < s.ends_at
    )
    and not exists (
      select 1
      from public.time_blocks t
      where t.barbershop_id = p_barber.barbershop_id
        and t.barber_id is null
        and quarter.at >= t.starts_at and quarter.at < t.ends_at
    )
  ) then
    raise exception 'nothing open to block'
      using errcode = 'P0001', hint = 'already_closed';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barber.barbershop_id
      and a.barber_id = p_barber.barber_id
      and a.status in ('confirmed', 'attended', 'no_show')
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'there is an appointment in between'
      using errcode = 'P0001', hint = 'overlaps_appointment';
  end if;
  if exists (
    select 1
    from public.time_blocks t
    where t.barbershop_id = p_barber.barbershop_id
      and t.barber_id = p_barber.barber_id
      and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'there is a block in between'
      using errcode = 'P0001', hint = 'overlaps_block';
  end if;

  insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
  values (p_barber.barbershop_id, p_barber.barber_id, p_starts_at, p_ends_at, nullif(btrim(p_reason), ''))
  returning id into new_id;
  return new_id;
end;
$$;

create function private.delete_time_block_of(p_barber private.barber_access, p_block_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if not p_barber.writable then
    raise exception 'the barbershop is read only'
      using errcode = 'P0001', hint = 'read_only';
  end if;

  delete from public.time_blocks t
  where t.id = p_block_id
    and t.barbershop_id = p_barber.barbershop_id
    and t.barber_id = p_barber.barber_id
    and t.ends_at > now();
  if not found then
    raise exception 'not a block of this barber'
      using errcode = 'P0001', hint = 'not_yours';
  end if;
end;
$$;

revoke all on function private.barber_agenda_of(private.barber_access, date, date) from public, anon, authenticated;
revoke all on function private.barber_appointment_of(private.barber_access, uuid) from public, anon, authenticated;
revoke all on function private.mark_appointment_of(private.barber_access, uuid, public.appointment_status)
  from public, anon, authenticated;
revoke all on function private.create_time_block_of(private.barber_access, timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function private.delete_time_block_of(private.barber_access, uuid) from public, anon, authenticated;

-- 7. The link functions, on the shared bodies ---------------------------------------------------
-- Same signatures, so their grants stay (anon and authenticated, by the
-- link) and so does what they do.

create or replace function public.barber_agenda(p_token_hash text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  barber private.barber_access;
begin
  select * into barber from private.barber_by_link(p_token_hash);
  if not found then
    return null;
  end if;
  return private.barber_agenda_of(barber, p_from, p_to);
end;
$$;

-- The phone of barber_appointment_of stays out: B-03 by the link never
-- shows it.
create or replace function public.barber_appointment(p_token_hash text, p_appointment_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  source public.appointment_source,
  created_at timestamptz,
  customer_name text,
  service_names text[],
  service_minutes integer[],
  visits integer,
  no_shows integer,
  writable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.starts_at, x.ends_at, x.status, x.source, x.created_at, x.customer_name,
         x.service_names, x.service_minutes, x.visits, x.no_shows, x.writable
  from private.barber_by_link(p_token_hash) b
  cross join lateral private.barber_appointment_of(
    row(b.barber_id, b.barbershop_id, b.display_name, b.barber_active,
        b.uses_barbershop_hours, b.barbershop_name, b.writable)::private.barber_access,
    p_appointment_id
  ) x
$$;

create or replace function public.mark_appointment_by_barber(
  p_token_hash text,
  p_appointment_id uuid,
  p_status public.appointment_status
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barber private.barber_access;
begin
  perform set_config('yapoin.actor', 'barber', true);

  select * into barber from private.barber_by_link(p_token_hash);
  if not found then
    raise exception 'unknown link'
      using errcode = 'P0001', hint = 'link_invalid';
  end if;

  perform private.mark_appointment_of(barber, p_appointment_id, p_status);
end;
$$;

create or replace function public.create_time_block_by_barber(
  p_token_hash text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barber private.barber_access;
begin
  perform set_config('yapoin.actor', 'barber', true);

  select * into barber from private.barber_by_link(p_token_hash);
  if not found then
    raise exception 'unknown link'
      using errcode = 'P0001', hint = 'link_invalid';
  end if;

  return private.create_time_block_of(barber, p_starts_at, p_ends_at, p_reason);
end;
$$;

create or replace function public.delete_time_block_by_barber(p_token_hash text, p_block_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barber private.barber_access;
begin
  perform set_config('yapoin.actor', 'barber', true);

  select * into barber from private.barber_by_link(p_token_hash);
  if not found then
    raise exception 'unknown link'
      using errcode = 'P0001', hint = 'link_invalid';
  end if;

  perform private.delete_time_block_of(barber, p_block_id);
end;
$$;

-- 8. The functions by session -------------------------------------------------------------------
-- Only authenticated. A session that is not of a professional gets null or
-- nothing to read, and not_professional to change.

create function public.my_agenda(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  barber private.barber_access;
begin
  select * into barber from private.barber_by_session();
  if not found then
    return null;
  end if;
  return private.barber_agenda_of(barber, p_from, p_to);
end;
$$;

create function public.my_appointment(p_appointment_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  source public.appointment_source,
  created_at timestamptz,
  customer_name text,
  customer_phone text,
  service_names text[],
  service_minutes integer[],
  visits integer,
  no_shows integer,
  writable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select x.*
  from private.barber_by_session() b
  cross join lateral private.barber_appointment_of(b, p_appointment_id) x
$$;

create function public.mark_my_appointment(p_appointment_id uuid, p_status public.appointment_status)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barber private.barber_access;
begin
  perform set_config('yapoin.actor', 'barber_session', true);

  select * into barber from private.barber_by_session();
  if not found then
    raise exception 'the session is not of a professional'
      using errcode = 'P0001', hint = 'not_professional';
  end if;

  perform private.mark_appointment_of(barber, p_appointment_id, p_status);
end;
$$;

create function public.create_my_time_block(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barber private.barber_access;
begin
  perform set_config('yapoin.actor', 'barber_session', true);

  select * into barber from private.barber_by_session();
  if not found then
    raise exception 'the session is not of a professional'
      using errcode = 'P0001', hint = 'not_professional';
  end if;

  return private.create_time_block_of(barber, p_starts_at, p_ends_at, p_reason);
end;
$$;

create function public.delete_my_time_block(p_block_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barber private.barber_access;
begin
  perform set_config('yapoin.actor', 'barber_session', true);

  select * into barber from private.barber_by_session();
  if not found then
    raise exception 'the session is not of a professional'
      using errcode = 'P0001', hint = 'not_professional';
  end if;

  perform private.delete_time_block_of(barber, p_block_id);
end;
$$;

-- 9. Whether the session is of a professional ---------------------------------------------------
-- For the sign-in and "Mi agenda" (task 7.6b): null when it is not.

create function public.my_professional_access()
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
    'barbershop', jsonb_build_object(
      'name', s.barbershop_name,
      'slug', b.slug,
      'writable', s.writable
    )
  )
  from private.barber_by_session() s
  join public.barbershops b on b.id = s.barbershop_id
$$;

revoke all on function public.my_agenda(date, date) from public, anon, authenticated;
revoke all on function public.my_appointment(uuid) from public, anon, authenticated;
revoke all on function public.mark_my_appointment(uuid, public.appointment_status) from public, anon, authenticated;
revoke all on function public.create_my_time_block(timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.delete_my_time_block(uuid) from public, anon, authenticated;
revoke all on function public.my_professional_access() from public, anon, authenticated;
grant execute on function public.my_agenda(date, date) to authenticated;
grant execute on function public.my_appointment(uuid) to authenticated;
grant execute on function public.mark_my_appointment(uuid, public.appointment_status) to authenticated;
grant execute on function public.create_my_time_block(timestamptz, timestamptz, text) to authenticated;
grant execute on function public.delete_my_time_block(uuid) to authenticated;
grant execute on function public.my_professional_access() to authenticated;
