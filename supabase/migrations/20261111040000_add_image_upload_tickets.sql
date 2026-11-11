-- Security review of task 2.4 (docs/tareas/2.4-configuracion.md, findings
-- MEDIUM and LOW): an image quota that a signed upload URL cannot skip.
--
-- The problem. private.images_under_quota counted the objects that already
-- exist, inside the insert policy of storage.objects. Storage runs that
-- policy when it SIGNS an upload URL (createSignedUploadUrl), as the session,
-- but the upload with the URL runs as the Storage service and no policy runs
-- again. Signing creates nothing, so an account could ask for thousands of
-- URLs (through the app or straight against the Storage API with its
-- session) while the folder still looked empty, and fill the public bucket.
--
-- The fix. A path must be reserved before it can be signed or uploaded:
--
-- 1. private.image_upload_tickets: one row per reserved path. No session
--    role has any privilege on it and RLS is on without policies, like
--    private.barbershop_creations.
-- 2. public.reserve_image_upload(path): a member of the barbershop of the
--    folder, while it is not deleted, reserves the path if the folder stays
--    within its quota. The quota counts every path that exists or may still
--    be written: the objects of the folder plus every ticket not expired,
--    with or without its object. An advisory lock per barbershop makes two
--    reservations of the same barbershop run one after the other.
-- 3. The insert policy of storage.objects asks for a ticket of that path
--    created in the last 5 minutes (the signing window) instead of counting
--    objects. Signing (or uploading) without reserving first fails.
--
-- Why a ticket counts until it expires, even once its object exists or after
-- the object is deleted: the signed URL stays valid for its whole life, and
-- the upload with it writes the path again with no policy. A ticket freed
-- earlier would let an account delete its objects, reserve new paths and
-- then write the old ones again, beyond the quota. So a ticket lives as long
-- as any upload started with it can still finish:
-- - the policy accepts a ticket for 5 minutes after the reservation (the
--   signing window; the app signs right after reserving);
-- - a signed upload URL is valid for 2 hours (Supabase docs and supabase-js
--   2.118, createSignedUploadUrl: "They are valid for 2 hours"; the client
--   cannot choose another lifetime);
-- - a resumable (TUS) upload started within that time, with the signed
--   token or with the session, may finish up to 24 hours later (Supabase
--   docs, Resumable uploads: "valid for up to 24 hours"), and the object
--   row is written when it finishes.
-- Hence expires_at = reservation + 26 h 5 min (provisional decision: the
-- safe bound; the app never uses resumable uploads, but an account may).
-- If any of those lifetimes grows, this interval must grow with it.
--
-- LOW finding (images uploaded and dropped without saving): the app now
-- deletes them as soon as the owner picks another one or removes it
-- (discardImageUpload), so the bucket does not keep them. Their path keeps
-- counting for the quota until its ticket expires (at most 26 h 5 min), not
-- until the monthly cleanup of task 5.1.
--
-- Deleted sedes (task 2.6b): their memberships are gone, so neither the
-- reservation nor the policy accepts their folder; both also check
-- deleted_at as a second wall. The reservation takes a key share lock on
-- the barbershop row, which waits for a deletion in flight (it locks the
-- row for update) and then sees it deleted.

-- 1. Tickets ---------------------------------------------------------------------------

create table private.image_upload_tickets (
  path text primary key,
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint image_upload_tickets_path_is_image_key check (private.is_image_key(path)),
  constraint image_upload_tickets_path_in_own_folder
    check (starts_with(path, barbershop_id::text || '/')),
  constraint image_upload_tickets_expires_after_creation check (expires_at > created_at)
);

-- The quota counts and the cleanup deletes the tickets of one barbershop.
create index image_upload_tickets_barbershop_id_expires_at_idx
  on private.image_upload_tickets (barbershop_id, expires_at);

alter table private.image_upload_tickets enable row level security;
revoke all on private.image_upload_tickets from public, anon, authenticated;

-- 2. The quota -----------------------------------------------------------------------
-- The same rule as migration add_photo_rules: two images per barber plus ten
-- for the logo, the cover and replacements in flight. Only
-- reserve_image_upload calls it.

create function private.image_quota(p_barbershop_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select (2 * count(*) + 10)::integer
  from public.barbers b
  where b.barbershop_id = p_barbershop_id
$$;

revoke all on function private.image_quota(uuid) from public;

-- 3. Reserving a path ------------------------------------------------------------------

create function public.reserve_image_upload(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  folder text;
  shop uuid;
begin
  -- <barbershop_id>/<kind>/<uuid>.<webp|jpg>, lowercase: anything else is
  -- refused before it is cast or counted.
  if p_path is null or not private.is_image_key(p_path) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  folder := split_part(p_path, '/', 1);
  shop := folder::uuid;

  -- A member of that barbershop (an active profile, never a super admin).
  if not (shop = any (private.member_barbershop_ids())) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- Not deleted. The key share lock waits for a deletion in flight
  -- (delete_barbershop locks the row for update) and then finds it deleted.
  perform 1
  from public.barbershops b
  where b.id = shop
    and b.deleted_at is null
  for key share;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- One reservation of this barbershop at a time, so two cannot both see
  -- the last free image. Each statement below sees what the previous holder
  -- committed (read committed takes a new snapshot per statement).
  perform pg_advisory_xact_lock(hashtext('image_quota:' || folder));

  delete from private.image_upload_tickets t
  where t.barbershop_id = shop
    and t.expires_at <= now();

  -- Every path that exists or may still be written, plus this one. Reserving
  -- a path already counted again takes no new room.
  if (
    select count(*) from (
      select o.name
      from storage.objects o
      where o.bucket_id = 'images'
        and o.name like folder || '/%'
      union
      select t.path
      from private.image_upload_tickets t
      where t.barbershop_id = shop
      union
      select p_path
    ) as used
  ) > private.image_quota(shop) then
    raise exception 'the barbershop reached its image quota'
      using errcode = 'check_violation', hint = 'image_quota';
  end if;

  -- The same path again (a retried request) renews its ticket instead of
  -- adding one: the signing window starts over, and the path keeps counting
  -- for as long as a URL signed now lives.
  insert into private.image_upload_tickets (path, barbershop_id, created_at, expires_at)
  values (p_path, shop, now(), now() + interval '26 hours 5 minutes')
  on conflict (path) do update
    set created_at = excluded.created_at,
        expires_at = excluded.expires_at;
end;
$$;

revoke all on function public.reserve_image_upload(text) from public, anon;
grant execute on function public.reserve_image_upload(text) to authenticated;

-- 4. The insert policy asks for a ticket ------------------------------------------------
-- Security definer: it reads tickets the caller has no privilege on, and only
-- answers yes or no, for paths of the caller's barbershops only, so it tells
-- nothing about another barbershop.

create function private.has_upload_ticket(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.image_upload_tickets t
    join public.barbershops b on b.id = t.barbershop_id
    where t.path = p_name
      -- The signing window: a URL signed with this ticket expires before
      -- the ticket does (see the header).
      and t.created_at > now() - interval '5 minutes'
      and t.barbershop_id = any (private.member_barbershop_ids())
      and b.deleted_at is null
  )
$$;

revoke all on function private.has_upload_ticket(text) from public;
grant execute on function private.has_upload_ticket(text) to authenticated;

-- There is no update policy on storage.objects (an image is replaced by a new
-- key, never overwritten), so an upsert cannot be signed either.
drop policy images_member_insert on storage.objects;
create policy images_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'images'
    and private.is_image_key(name)
    and (storage.foldername(name))[1] = any ((select private.member_barbershop_ids())::text[])
    and private.has_upload_ticket(name)
  );

-- The old quota had no other caller.
drop function private.images_under_quota(text);
