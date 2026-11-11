-- Task 2.6: "Nueva sede" (spec, Usuarios y roles; decision 0006). One tap
-- creates one barbershop, however many times the form reaches the server.
--
-- Each sede is a barbershop with its own subscription, so a second creation
-- from a double tap, a retried request or a form sent again from the back
-- button would leave the owner with a sede (and a bill) they never asked
-- for. The screen sends a random request id with the form; create_barbershop
-- remembers which barbershop each request id created and, when the same id
-- arrives again, returns that barbershop instead of creating another.
--
-- 1. private.barbershop_creations: request id → barbershop. Only
--    create_barbershop (security definer) reads or writes it; no session
--    role has any privilege on it, and RLS is on without policies as a
--    second wall.
-- 2. create_barbershop takes p_request_id (optional: without it, every call
--    creates, as before). An advisory lock on the request id makes two
--    simultaneous calls with the same id run one after the other; the second
--    one finds the row of the first. A request id of another account is
--    refused (42501), so it never reveals another account's barbershop.

-- 1. What each request created ------------------------------------------------------

create table private.barbershop_creations (
  request_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index barbershop_creations_user_id_idx
  on private.barbershop_creations (user_id);
create index barbershop_creations_barbershop_id_idx
  on private.barbershop_creations (barbershop_id);

alter table private.barbershop_creations enable row level security;
revoke all on private.barbershop_creations from public, anon, authenticated;

-- 2. create_barbershop, once per request -------------------------------------------------

drop function public.create_barbershop(text, text, text);

create function public.create_barbershop(
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
  select p.phone into caller_phone
  from public.profiles p
  where p.id = caller
    and p.active
    and not p.is_super_admin;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- The same request again: the barbershop it already created. The lock
  -- makes a simultaneous second call wait for the first to commit or roll
  -- back; the select after it sees whichever happened.
  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtext('create_barbershop:' || p_request_id::text));
    select c.user_id, c.barbershop_id into earlier
    from private.barbershop_creations c
    where c.request_id = p_request_id;
    if found then
      if earlier.user_id is distinct from caller then
        raise exception 'not allowed' using errcode = 'insufficient_privilege';
      end if;
      return earlier.barbershop_id;
    end if;
  end if;

  -- The company trial: the one of the owner's first barbershop.
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
