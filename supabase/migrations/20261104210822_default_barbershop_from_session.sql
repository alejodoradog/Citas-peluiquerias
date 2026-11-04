-- Task 1.7: owner inserts default barbershop_id to the session's barbershop.
-- See docs/decisiones/0005-convenciones-de-codigo.md.
--
-- A safety net: the app still sends barbershop_id, but a screen that forgets
-- it writes to the owner's own barbershop instead of failing. RLS still
-- checks the value either way. Without an owner session the default is null
-- and the insert fails (not null), as before.
--
-- Not on barbershops (the tenant root), profiles (created by signup),
-- notifications and subscription_payments (written by the platform, never by
-- the owner).

alter table public.barbers
  alter column barbershop_id set default private.current_barbershop_id();
alter table public.barber_schedules
  alter column barbershop_id set default private.current_barbershop_id();
alter table public.barbershop_hours
  alter column barbershop_id set default private.current_barbershop_id();
alter table public.holiday_openings
  alter column barbershop_id set default private.current_barbershop_id();
alter table public.services
  alter column barbershop_id set default private.current_barbershop_id();
alter table public.barber_services
  alter column barbershop_id set default private.current_barbershop_id();
alter table public.time_blocks
  alter column barbershop_id set default private.current_barbershop_id();
alter table public.customers
  alter column barbershop_id set default private.current_barbershop_id();
alter table public.appointments
  alter column barbershop_id set default private.current_barbershop_id();
