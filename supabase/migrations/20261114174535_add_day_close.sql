-- Task 4.6 (docs/tareas/4.6-cierre-del-dia.md): "Cierre del día" (D-64).
--
-- The day close is worked out by the app from what the owner already reads
-- (appointments, their lines with the price each one copied, and barbers);
-- the database only keeps the barbers' commission of each barbershop.
--
-- - commission_percent: one percentage for the whole barbershop, as D-64
--   draws it (decision C1, provisional). It starts at 0, so no commission is
--   shown until the owner picks one; the owner who also cuts never has one
--   (decision C2, in the app).
-- - Sessions update it by column, like the other settings of the panel
--   (20261104162412); the member_update policy keeps each owner inside their
--   own barbershops. anon never reads it: it is not on the public page.

alter table public.barbershops
  add column commission_percent smallint not null default 0,
  add constraint barbershops_commission_percent_range
    check (commission_percent between 0 and 100);

grant update (commission_percent) on public.barbershops to authenticated;
