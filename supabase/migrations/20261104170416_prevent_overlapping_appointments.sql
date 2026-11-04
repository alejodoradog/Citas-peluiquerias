-- Task 1.3: two active appointments of the same barber never overlap.
-- See docs/decisiones/0003-citas-sin-cruces.md.
--
-- - Active means the appointment holds its slot (spec, "Estados de una cita"):
--   confirmed, attended and no_show. Cancelled appointments free the slot.
-- - Ranges are half-open [start, end), so back-to-back appointments are fine.
-- - Two bookings racing for the same slot: the second waits for the first and
--   then fails with SQLSTATE 23P01 (exclusion_violation).
-- - Blocks and opening hours are not enforced here. The availability engine
--   (3.1) and the public booking (3.3) respect them; the owner may still book
--   by hand over a block.

-- Lets a GiST index compare barber_id (uuid) with =.
create extension if not exists btree_gist with schema extensions;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('confirmed', 'attended', 'no_show'));
