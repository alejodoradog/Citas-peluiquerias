-- Task 1.8: email is the only messaging channel, and nothing is verified by code.
-- See docs/decisiones/0006-correo-unico-canal.md.
--
-- - A customer is identified by email within a barbershop. A phone can no longer
--   identify anyone: without verification, anybody could type someone else's.
-- - A manual appointment needs only a name, so email and phone are both optional.
-- - barbershops.whatsapp_phone stays, only as the barbershop's contact.

-- Emails are stored trimmed and in lowercase, so one person is one customer.
create function private.is_email(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value = lower(btrim(value))
    and char_length(value) <= 254
    and value ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
$$;

-- New functions are closed by default. Owners and server jobs write these
-- columns; the public booking will write through a security definer function
-- (task 3.3).
grant execute on function private.is_email(text) to authenticated, service_role;

-- customers ---------------------------------------------------------------------

alter table public.customers
  add column email text check (private.is_email(email)),
  alter column phone drop not null,
  drop constraint customers_barbershop_id_phone_key,
  add constraint customers_barbershop_id_email_key unique (barbershop_id, email);

create index customers_phone_idx on public.customers (barbershop_id, phone);

-- barbers -----------------------------------------------------------------------

alter table public.barbers
  drop constraint barbers_notifications_need_phone,
  drop column phone,
  add column email text check (private.is_email(email));

alter table public.barbers
  rename column whatsapp_notifications to email_notifications;

alter table public.barbers
  add constraint barbers_notifications_need_email
  check (not email_notifications or email is not null);

-- The column list of the original grant does not cover a new column. Anon stays
-- without access to it.
grant select (email) on public.barbers to authenticated;

-- notifications -----------------------------------------------------------------

alter table public.notifications drop column channel;
drop type public.notification_channel;
