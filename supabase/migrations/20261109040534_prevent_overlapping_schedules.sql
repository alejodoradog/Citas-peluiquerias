-- Weekly shifts of the same barber, or of the same barbershop, never overlap on
-- the same weekday. Wall-clock times are placed on a fixed day to form a range;
-- only built-in immutable operators, so no grant is needed to evaluate it.
-- Half-open [start, end): 08:00-12:00 and 12:00-18:00 do not overlap.

alter table public.barber_schedules
  add constraint barber_schedules_no_overlap
  exclude using gist (
    barber_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') with &&
  );

alter table public.barbershop_hours
  add constraint barbershop_hours_no_overlap
  exclude using gist (
    barbershop_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') with &&
  );
