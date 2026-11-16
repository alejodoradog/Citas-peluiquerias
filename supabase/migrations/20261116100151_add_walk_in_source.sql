-- Task 7.7 (docs/tareas/7.7-cita-inmediata.md): the walk-in appointment, for
-- a customer who arrives without a booking.
--
-- Its own origin, so the agenda, the history and the numbers tell it from a
-- manual appointment. It goes in a migration of its own: a value added to an
-- enum cannot be used in the transaction that adds it, and the next
-- migration (add_walk_in_appointments) uses it.
--
-- Nothing changes for the paths that exist: private.check_appointment_source
-- and public.create_appointment still let a session (authenticated) create
-- 'manual' appointments only, so 'walk_in' is reachable only through the
-- security definer functions of the next migration.

alter type public.appointment_source add value if not exists 'walk_in';
