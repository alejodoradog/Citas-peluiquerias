-- Task 2.3, a barber's private link (D-56; docs/tareas/2.3-link-privado.md).
--
-- 1. barbers.link_issued_at says when the owner last copied or shared a new
--    link ("Enviado el 3 de noviembre"); null while it was never issued
--    ("Link sin enviar"). Only the database writes it.
-- 2. A link that was turned off comes back only with a new token: the old one
--    may be in the hands of whoever lost the phone or left.
-- 3. The owner's barber never has a link: the owner sees the whole agenda from
--    their account (D-53).

-- 1. When the link was issued ---------------------------------------------------------

alter table public.barbers add column link_issued_at timestamptz;

-- The wizard already leaves the owner without a link; this covers any row a
-- session changed by hand before the check below existed.
update public.barbers set link_active = false where is_owner and link_active;

-- 2. Issued and revived only with a new token ---------------------------------------------
-- Security invoker on purpose: it reads and writes only the row being saved.

create function private.guard_barber_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- A new barber's token was thrown away: nobody has their link yet.
    new.link_issued_at := null;
    return new;
  end if;
  if new.link_active and not old.link_active
     and new.link_token_hash = old.link_token_hash then
    raise exception 'a link turned off needs a new token'
      using errcode = 'check_violation', hint = 'link_needs_new_token';
  end if;
  new.link_issued_at := case
    when new.link_active and new.link_token_hash is distinct from old.link_token_hash
      then now()
    else old.link_issued_at
  end;
  return new;
end;
$$;

create trigger guard_barber_link
  before insert or update on public.barbers
  for each row execute function private.guard_barber_link();

-- 3. The owner has no link ---------------------------------------------------------------------

alter table public.barbers
  add constraint barbers_owner_has_no_link check (not (is_owner and link_active));

-- Sessions read the date and never write it (the column grants of insert and
-- update leave it out).
grant select (link_issued_at) on public.barbers to authenticated;
