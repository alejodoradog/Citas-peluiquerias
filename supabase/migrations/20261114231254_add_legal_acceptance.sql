-- Task 6.5 (docs/tareas/6.5-legal.md): the terms of use and the data policy,
-- with the express authorization of Ley 1581 de 2012 (article 9) kept as
-- proof: when it was accepted and which version (the date of the text, as
-- src/ui/textos.ts says it, legal.version).
--
-- - The owner accepts them at sign-up: the form sends the version in the
--   metadata of the account, and a trigger after register_owner_on_signup
--   keeps it in the profile.
-- - The customer accepts the data policy at the booking: the app's server
--   keeps it in the customer after book_appointment_from_app (only the
--   server key). A customer who books again keeps the latest acceptance.

alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column terms_version text check (char_length(terms_version) between 1 and 20);

alter table public.customers
  add column privacy_accepted_at timestamptz,
  add column privacy_version text check (char_length(privacy_version) between 1 and 20);

-- After on_auth_user_created (triggers run in name order), which made the
-- profile.
create function private.record_terms_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'terms_version', '')), '');
begin
  if accepted is not null and char_length(accepted) <= 20 then
    update public.profiles
    set terms_accepted_at = now(), terms_version = accepted
    where id = new.id;
  end if;
  return null;
end;
$$;

revoke all on function private.record_terms_acceptance() from public;

create trigger record_terms_acceptance
  after insert on auth.users
  for each row execute function private.record_terms_acceptance();

create function public.record_privacy_acceptance(
  p_barbershop_id uuid,
  p_appointment_id uuid,
  p_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_version is null or char_length(btrim(p_version)) not between 1 and 20 then
    raise exception 'invalid version' using errcode = 'invalid_parameter_value';
  end if;
  update public.customers c
  set privacy_accepted_at = now(), privacy_version = btrim(p_version)
  from public.appointments a
  where a.barbershop_id = p_barbershop_id
    and a.id = p_appointment_id
    and c.barbershop_id = a.barbershop_id
    and c.id = a.customer_id;
end;
$$;

revoke all on function public.record_privacy_acceptance(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_privacy_acceptance(uuid, uuid, text) to service_role;
