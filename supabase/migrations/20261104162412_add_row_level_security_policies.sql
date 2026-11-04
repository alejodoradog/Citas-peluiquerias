-- Tasks 1.2 and 1.5: row level security policies and table privileges.
-- See docs/decisiones/0002-politicas-rls.md.
--
-- Who is who:
-- - anon: the public booking page. Public pages always query without a session.
-- - authenticated with an active owner profile: works only inside their barbershop.
-- - authenticated with an active super admin profile: reads everything. Writes
--   to subscriptions go through security definer functions (task 5.4).
-- - service_role: server jobs; bypasses RLS.
-- Barbers and customers have no accounts. Their links are checked by functions
-- that receive the token (tasks 3.4 and 4.4), not by policies.

-- Helpers -----------------------------------------------------------------------
-- security definer so they can read profiles without recursing into its RLS.

create function private.current_barbershop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.barbershop_id
  from public.profiles p
  where p.id = auth.uid()
    and p.role = 'owner'
    and p.active
$$;

create function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
      and p.active
  )
$$;

-- The caller's own profile id, only while that profile is active.
create function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.id = auth.uid()
    and p.active
$$;

revoke all on function private.current_barbershop_id() from public;
revoke all on function private.is_super_admin() from public;
revoke all on function private.current_profile_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_barbershop_id() to authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.current_profile_id() to authenticated;

-- Privileges: an allowlist ------------------------------------------------------
-- Start from nothing, so a future table or function stays closed until it is
-- granted on purpose. Column lists keep subscription data, phones, reasons and link hashes
-- away from roles that must not read or change them.

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
-- Postgres lets everyone execute a new function. Future functions, such as
-- registering a payment, must be granted explicitly.
alter default privileges revoke execute on functions from public;

-- anon: only what the booking page needs.
grant select (
  id, name, slug, logo_path, cover_photo_path, address, latitude, longitude,
  whatsapp_phone, min_booking_notice_minutes, cancellation_notice_hours,
  deposit_method, deposit_account
) on public.barbershops to anon;
grant select (id, barbershop_id, name, price_cop, duration_minutes, active)
  on public.services to anon;
grant select (id, barbershop_id, display_name, photo_path, sort_order, active)
  on public.barbers to anon;
grant select (id, barbershop_id, barber_id, starts_at, ends_at)
  on public.time_blocks to anon;
grant select on public.barber_services, public.barber_schedules,
  public.barbershop_hours, public.holiday_openings to anon;

-- authenticated: owners and super admins. Policies narrow the rows.
grant select on public.barbershops to authenticated;
grant update (
  name, slug, logo_path, cover_photo_path, address, latitude, longitude,
  whatsapp_phone, min_booking_notice_minutes, cancellation_notice_hours,
  deposit_method, deposit_account
) on public.barbershops to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Link hashes can be written when a link is created or regenerated, never read.
grant select (
  id, barbershop_id, display_name, photo_path, phone, link_active,
  whatsapp_notifications, sort_order, active, created_at, updated_at
) on public.barbers to authenticated;
grant insert, update, delete on public.barbers to authenticated;

grant select (
  id, barbershop_id, customer_id, barber_id, service_id, starts_at, ends_at,
  price_cop, status, source, deposit_received, created_at, updated_at
) on public.appointments to authenticated;
-- No delete: appointments are history.
grant insert, update on public.appointments to authenticated;

grant select, insert, update, delete on
  public.services, public.barber_services, public.barber_schedules,
  public.barbershop_hours, public.holiday_openings, public.time_blocks,
  public.customers
to authenticated;

grant select on public.notifications, public.subscription_payments to authenticated;

-- Policies: public booking page -------------------------------------------------

create policy public_read on public.barbershops
  for select to anon using (true);
create policy public_read on public.services
  for select to anon using (active);
create policy public_read on public.barbers
  for select to anon using (active);
create policy public_read on public.barber_services
  for select to anon using (true);
create policy public_read on public.barber_schedules
  for select to anon using (true);
create policy public_read on public.barbershop_hours
  for select to anon using (true);
create policy public_read on public.holiday_openings
  for select to anon using (true);
create policy public_read on public.time_blocks
  for select to anon using (true);

-- Policies: super admin reads every table ---------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'barbershops', 'profiles', 'barbers', 'barber_schedules', 'barbershop_hours',
    'holiday_openings', 'services', 'barber_services', 'time_blocks', 'customers',
    'appointments', 'notifications', 'subscription_payments'
  ] loop
    execute format(
      'create policy super_admin_read on public.%I for select to authenticated
         using ((select private.is_super_admin()))',
      t
    );
  end loop;
end;
$$;

-- Policies: owners, inside their own barbershop ----------------------------------
-- (select ...) lets Postgres evaluate the helper once per query, not per row.

create policy owner_read on public.barbershops
  for select to authenticated
  using (id = (select private.current_barbershop_id()));
create policy owner_update on public.barbershops
  for update to authenticated
  using (id = (select private.current_barbershop_id()))
  with check (id = (select private.current_barbershop_id()));

create policy own_profile_read on public.profiles
  for select to authenticated
  using (id = (select private.current_profile_id()));
create policy own_profile_update on public.profiles
  for update to authenticated
  using (id = (select private.current_profile_id()))
  with check (id = (select private.current_profile_id()));

-- Full management of the barbershop's own data.
do $$
declare
  t text;
begin
  foreach t in array array[
    'barbers', 'services', 'barber_services', 'barber_schedules',
    'barbershop_hours', 'holiday_openings', 'time_blocks', 'customers'
  ] loop
    execute format(
      'create policy owner_read on public.%I for select to authenticated
         using (barbershop_id = (select private.current_barbershop_id()))',
      t
    );
    execute format(
      'create policy owner_insert on public.%I for insert to authenticated
         with check (barbershop_id = (select private.current_barbershop_id()))',
      t
    );
    execute format(
      'create policy owner_update on public.%I for update to authenticated
         using (barbershop_id = (select private.current_barbershop_id()))
         with check (barbershop_id = (select private.current_barbershop_id()))',
      t
    );
    execute format(
      'create policy owner_delete on public.%I for delete to authenticated
         using (barbershop_id = (select private.current_barbershop_id()))',
      t
    );
  end loop;
end;
$$;

create policy owner_read on public.appointments
  for select to authenticated
  using (barbershop_id = (select private.current_barbershop_id()));
create policy owner_insert on public.appointments
  for insert to authenticated
  with check (barbershop_id = (select private.current_barbershop_id()));
create policy owner_update on public.appointments
  for update to authenticated
  using (barbershop_id = (select private.current_barbershop_id()))
  with check (barbershop_id = (select private.current_barbershop_id()));

create policy owner_read on public.subscription_payments
  for select to authenticated
  using (barbershop_id = (select private.current_barbershop_id()));

-- notifications: no owner policy. Only the super admin and server jobs see it.
