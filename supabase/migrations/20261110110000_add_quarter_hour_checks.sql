-- Task 2.4 (security review): weekly hours are kept to quarter hours.
--
-- The screens offer times every 15 minutes (D-55, D-58, setup wizard) and the
-- actions refuse anything else, but a session can write barbershop_hours and
-- barber_schedules straight through the API (member_* policies), and the
-- functions set_barbershop_hours, set_barber_schedule and
-- complete_barbershop_setup cast whatever text they get. The availability
-- engine (task 3.1) builds slots on that grid, so the table states it: whole
-- minutes on :00, :15, :30 or :45, no seconds (fractions included).
--
-- Every row written so far came from those screens or from the seed, all on
-- quarter hours; the constraints are validated on creation, so a row that
-- is not makes this migration fail instead of hiding.

alter table public.barbershop_hours
  add constraint barbershop_hours_quarter_hours check (
    extract(second from start_time) = 0
    and extract(minute from start_time)::int % 15 = 0
    and extract(second from end_time) = 0
    and extract(minute from end_time)::int % 15 = 0
  );

alter table public.barber_schedules
  add constraint barber_schedules_quarter_hours check (
    extract(second from start_time) = 0
    and extract(minute from start_time)::int % 15 = 0
    and extract(second from end_time) = 0
    and extract(minute from end_time)::int % 15 = 0
  );
