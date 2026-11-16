-- Task 7.3 (docs/tareas/7.3-asistente.md): the location of the establishment
-- is required (founder, 2026-11-15), so the customer always finds the map on
-- the booking page.
--
-- - The wizard cannot be finished without it: setup_completed_at is only set
--   on a barbershop that has its point (latitude and longitude go together,
--   barbershops_location_both).
-- - Once the establishment is set up, the point can be marked again but not
--   removed.
-- - A barbershop set up before this rule, without a point, stays as it is
--   until its owner marks one.
--
-- The rule is a trigger and not a CHECK because it depends on what the row
-- had: a CHECK would refuse every row from before the rule.

create function private.require_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.setup_completed_at is not null
    and new.latitude is null
    -- Allowed only to the ones that were already set up without a point.
    and (old.setup_completed_at is null or old.latitude is not null) then
    raise exception 'the establishment needs its location'
      using errcode = 'check_violation', hint = 'location_required';
  end if;
  return new;
end;
$$;

revoke all on function private.require_location() from public;

create trigger require_location
  before update of setup_completed_at, latitude, longitude on public.barbershops
  for each row execute function private.require_location();
