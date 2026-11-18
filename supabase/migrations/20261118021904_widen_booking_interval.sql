-- Task 8.15: the booking interval also offers every 5 and every 10 minutes.
-- Only the check widens; booking_time_problem already takes any interval
-- that divides the hour, and 5 and 10 do.
alter table public.barbershops
  drop constraint barbershops_booking_interval_minutes_check,
  add constraint barbershops_booking_interval_minutes_check
    check (booking_interval_minutes in (5, 10, 15, 30, 60));
