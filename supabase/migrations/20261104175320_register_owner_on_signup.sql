-- Task 1.4: signing up creates the barbershop and its owner in one step.
-- See docs/decisiones/0004-registro-e-ingreso.md.
--
-- The app calls supabase.auth.signUp with the registration as user metadata:
-- owner_name, barbershop_name, barbershop_slug and phone (already validated
-- and normalized by src/modulos/barberias/dominio). This trigger runs in the
-- same transaction as the new auth user, so if anything is invalid the whole
-- signup fails and no account is left without a barbershop.
--
-- Metadata comes from the browser, so it is never trusted for anything that
-- matters: the role is always owner and the trial expiry is computed here.

-- Top-level routes of the app, and links that could pass for the platform
-- itself, cannot be a barbershop link.
-- Keep in sync with RESERVED_SLUGS in src/modulos/barberias/dominio/slug.ts.
alter table public.barbershops
  add constraint barbershops_slug_not_reserved
  check (slug not in (
    'admin', 'api', 'auth', 'ayuda', 'b', 'ingresar', 'login', 'nueva-clave',
    'panel', 'privacidad', 'recuperar-clave', 'registro', 'salir', 'soporte',
    'terminos', 'www'
  ));

create function private.register_owner_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_barbershop_id uuid;
begin
  -- Accounts created by hand, such as super admins, carry no barbershop.
  if not meta ? 'barbershop_name' then
    return new;
  end if;

  -- The owner's Colombian mobile, normalized by the app. Checked here too
  -- because the signup API can be called without going through the app.
  if coalesce(meta ->> 'phone', '') !~ '^\+573[0-9]{9}$' then
    raise exception 'invalid phone for signup'
      using errcode = 'check_violation';
  end if;

  insert into public.barbershops (name, slug, whatsapp_phone, expires_on)
  values (
    btrim(meta ->> 'barbershop_name'),
    meta ->> 'barbershop_slug',
    meta ->> 'phone',
    -- Free trial: the signup day in Bogotá plus 20 full days. Same rule as
    -- trialEndsOn in src/modulos/suscripciones/dominio/trial.ts.
    (now() at time zone 'America/Bogota')::date + 20
  )
  returning id into new_barbershop_id;

  insert into public.profiles (id, barbershop_id, role, full_name, phone)
  values (
    new.id,
    new_barbershop_id,
    'owner',
    btrim(meta ->> 'owner_name'),
    meta ->> 'phone'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.register_owner_on_signup();
