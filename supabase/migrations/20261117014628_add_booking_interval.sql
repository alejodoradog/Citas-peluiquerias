-- Task 7.11 (docs/tareas/7.11-intervalo.md): each establishment chooses every
-- how many minutes its customers are offered times: 15 (the default, as
-- until now), 30 or 60, counted from the hour of the Bogotá clock
-- (provisional decision D8). Only what customers do follows it: booking and
-- moving their own appointment. The owner's appointments, blocks and the
-- appointment "al momento" (task 7.7) stay free.

-- 1. The interval -----------------------------------------------------------------------------------

alter table public.barbershops
  add column booking_interval_minutes integer not null default 15
    constraint barbershops_booking_interval_minutes_check
      check (booking_interval_minutes in (15, 30, 60));

-- The booking page reads it (anon, the public profile); the owner changes it
-- in Más › Reservas y cancelaciones, with the same row policies as the other
-- settings (their own establishments, never one that is paused).
grant select (booking_interval_minutes) on public.barbershops to anon;
grant update (booking_interval_minutes) on public.barbershops to authenticated;

-- 2. The database refuses a time off the grid -------------------------------------------------------
-- Same function as in add_public_booking, with the grid of the establishment
-- instead of the quarter hour. 15, 30 and 60 divide the hour, so the minute
-- of the Bogotá clock tells it. A request made by hand cannot skip it.

create or replace function private.booking_time_problem(
  p_barbershop_id uuid,
  p_starts_at timestamptz,
  p_minutes integer,
  p_now timestamptz
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when b.id is null then 'not_accepting'
    when p_starts_at is null or p_now is null or p_minutes is null
      or p_minutes not between 5 and 480 then 'slot_invalid'
    -- The establishment's grid on the Bogotá clock, no seconds (fractions
    -- included) (task 7.11).
    when extract(second from clock.start_local) <> 0
      or extract(minute from clock.start_local)::integer % b.booking_interval_minutes <> 0 then 'slot_invalid'
    -- Today to today + 30 in Bogotá, both included (3.1, P1).
    when clock.start_local::date < clock.today
      or clock.start_local::date > clock.today + private.booking_window_days() then 'outside_booking_window'
    -- The notice counts up to the start, the edge included (3.1, P6).
    when p_starts_at < p_now + make_interval(mins => b.min_booking_notice_minutes) then 'booking_notice'
    -- A holiday is closed unless the barbershop opens it.
    when private.is_colombian_holiday(clock.start_local::date)
      and not exists (
        select 1 from public.holiday_openings h
        where h.barbershop_id = b.id and h.holiday_date = clock.start_local::date
      ) then 'closed'
    else null
  end
  from (
    select p_starts_at at time zone 'America/Bogota' as start_local,
           (p_now at time zone 'America/Bogota')::date as today
  ) as clock
  left join public.barbershops b on b.id = p_barbershop_id
$$;
