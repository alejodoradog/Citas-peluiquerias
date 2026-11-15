-- The landing page (2026-11-15): yapoin.com is the landing and /app is the
-- entry the owners keep on their phone's home screen. "app" becomes a route,
-- so no barbershop can take it as its link. Keep in sync with RESERVED_SLUGS
-- in src/modulos/barberias/dominio/slug.ts (slug.test.ts checks it).

alter table public.barbershops
  drop constraint barbershops_slug_not_reserved;
alter table public.barbershops
  add constraint barbershops_slug_not_reserved
  check (slug not in (
    'admin', 'api', 'app', 'auth', 'ayuda', 'b', 'c', 'ingresar', 'login', 'nueva-clave',
    'panel', 'privacidad', 'recuperar-clave', 'registro', 'salir', 'soporte',
    'terminos', 'www'
  ));
