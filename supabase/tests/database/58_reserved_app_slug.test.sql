-- The landing page (2026-11-15), migration reserve_app_slug: /app is the
-- owners' entry, so no barbershop can take "app" as its link.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(2);

select throws_ok(
  $$insert into public.barbershops (name, slug, whatsapp_phone, trial_ends_on, expires_on)
    values ('App', 'app', '+573001112233', current_date + 10, current_date + 10)$$,
  '23514', null,
  'no barbershop takes "app" as its link'
);
select lives_ok(
  $$insert into public.barbershops (name, slug, whatsapp_phone, trial_ends_on, expires_on)
    values ('App Barber', 'app-barber', '+573001112233', current_date + 10, current_date + 10)$$,
  'a link that only starts with "app" is fine'
);

select * from finish();
rollback;
