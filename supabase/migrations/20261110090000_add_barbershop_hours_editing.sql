-- Task 2.4a, the barbershop's hours (D-58; docs/tareas/2.4-configuracion.md).
--
-- set_barbershop_hours replaces the whole week in one transaction. It runs as
-- the caller (security invoker): sessions already insert and delete
-- barbershop_hours under the member_* policies, so the function adds no
-- privilege; it only makes the replacement atomic and states its rules.
--
-- - Only a member of the barbershop: the check comes first, so a stranger
--   learns nothing and changes nothing (RLS would also hide the rows).
-- - At least one shift: a barbershop always closed takes no bookings
--   (decision P5 of task 2.4). At most 14 (the screen sends two a day at
--   most), each one an object with weekday, start and end.
-- - Overlaps fail through barbershop_hours_no_overlap (23P01) and roll the
--   whole week back, so the hours before stay as they were.
-- - The barbershop row is locked first (for no key update, which does not
--   block bookings that only reference it). Two saves at once run one after
--   the other; without the lock, the second delete would not see the rows the
--   first one inserted and the week would end up as a mix of both.
-- - Barbers' own hours are not touched: the availability engine (task 3.1)
--   crosses both (decision 8 of task 2.2).

create function public.set_barbershop_hours(p_barbershop_id uuid, p_shifts jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_barbershop_id is null or not (p_barbershop_id = any (private.member_barbershop_ids())) then
    raise exception 'not a member of this barbershop'
      using errcode = 'insufficient_privilege', hint = 'not_member';
  end if;

  perform 1 from public.barbershops b where b.id = p_barbershop_id for no key update;

  if jsonb_typeof(p_shifts) is distinct from 'array' or jsonb_array_length(p_shifts) = 0 then
    raise exception 'opening hours required'
      using errcode = 'check_violation', hint = 'hours_required';
  end if;
  if jsonb_array_length(p_shifts) > 14 or exists (
    select 1 from jsonb_array_elements(p_shifts) x
    where jsonb_typeof(x) is distinct from 'object'
      or jsonb_typeof(x -> 'weekday') is distinct from 'number'
      or jsonb_typeof(x -> 'start') is distinct from 'string'
      or jsonb_typeof(x -> 'end') is distinct from 'string'
  ) then
    raise exception 'at most 14 shifts of weekday, start and end'
      using errcode = 'check_violation', hint = 'shifts_invalid';
  end if;

  delete from public.barbershop_hours h where h.barbershop_id = p_barbershop_id;
  insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
  select p_barbershop_id, (x ->> 'weekday')::smallint, (x ->> 'start')::time, (x ->> 'end')::time
  from jsonb_array_elements(p_shifts) x;
end;
$$;

revoke all on function public.set_barbershop_hours(uuid, jsonb) from public;
grant execute on function public.set_barbershop_hours(uuid, jsonb) to authenticated;
