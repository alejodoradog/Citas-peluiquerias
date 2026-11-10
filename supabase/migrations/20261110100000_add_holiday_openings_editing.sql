-- Task 2.4c, holidays and closures (D-59; docs/tareas/2.4-configuracion.md).
--
-- set_holiday_openings sets which holidays of a range the barbershop opens,
-- in one transaction. It runs as the caller (security invoker): sessions
-- already insert and delete holiday_openings under the member_* policies, so
-- the function adds no privilege; it only makes the change atomic and states
-- its rules.
--
-- - Only a member of the barbershop: the check comes first, so a stranger
--   learns nothing and changes nothing (RLS would also hide the rows).
-- - The range is what D-59 shows (12 months from today, decision P7): at most
--   401 days, so a call cannot sweep the whole history. Rows outside it are
--   not touched. Every date sent falls inside it.
-- - Whether a date is a holiday is not checked here: the app checks it
--   (src/lib/fechas/festivos.ts), and opening an ordinary day has no effect.
-- - The barbershop row is locked first (for no key update, which does not
--   block bookings that only reference it). Two saves at once run one after
--   the other; without the lock, each delete would miss the rows the other
--   one inserted and the result would mix both.
--
-- Special closures need no function: they are time_blocks without a barber,
-- which sessions insert and delete under the member_* policies, and
-- check_time_block_rules lets through (it only checks blocks of a barber).

create function public.set_holiday_openings(
  p_barbershop_id uuid,
  p_from date,
  p_until date,
  p_dates date[]
)
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

  if p_from is null or p_until is null or p_until < p_from or p_until - p_from > 400 then
    raise exception 'a range of at most 401 days'
      using errcode = 'check_violation', hint = 'holidays_invalid';
  end if;
  if cardinality(p_dates) > 401 or exists (
    select 1 from unnest(p_dates) d where d is null or d < p_from or d > p_until
  ) then
    raise exception 'dates inside the range'
      using errcode = 'check_violation', hint = 'holidays_invalid';
  end if;

  delete from public.holiday_openings h
  where h.barbershop_id = p_barbershop_id
    and h.holiday_date between p_from and p_until
    and not (h.holiday_date = any (coalesce(p_dates, '{}')));

  insert into public.holiday_openings (barbershop_id, holiday_date)
  select distinct p_barbershop_id, d from unnest(p_dates) d
  on conflict (barbershop_id, holiday_date) do nothing;
end;
$$;

revoke all on function public.set_holiday_openings(uuid, date, date, date[]) from public;
grant execute on function public.set_holiday_openings(uuid, date, date, date[]) to authenticated;
