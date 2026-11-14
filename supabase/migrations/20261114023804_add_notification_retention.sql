-- Task 5.1: the message queue stays small. It is the fastest-growing table, so
-- finished messages are purged after 90 days; pending ones are never purged.
-- See docs/decisiones/0006-esquema-base-de-datos-final.md.

-- Appointment messages point at their appointment; subscription messages do not.
alter table public.notifications
  add constraint notifications_appointment_matches_type check (
    (appointment_id is not null) = (type in (
      'appointment_confirmed', 'appointment_reminder', 'appointment_cancelled',
      'appointment_rescheduled', 'barber_new_booking', 'barber_booking_cancelled'
    ))
  );

-- Status changes rewrite every row once or twice: leave room for HOT updates
-- and vacuum before the table bloats.
alter table public.notifications set (
  fillfactor = 90,
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02
);

create index notifications_purge_idx
  on public.notifications (created_at)
  where status <> 'pending';

create function private.purge_notifications(
  keep interval default interval '90 days',
  batch_size integer default 5000
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
  total integer := 0;
begin
  loop
    delete from public.notifications
    where id in (
      select n.id
      from public.notifications n
      where n.status <> 'pending'
        and n.created_at < now() - keep
      order by n.created_at
      limit batch_size
    );
    get diagnostics deleted = row_count;
    total := total + deleted;
    exit when deleted < batch_size;
  end loop;
  return total;
end;
$$;

revoke all on function private.purge_notifications(interval, integer) from public;

-- Every day at 03:30 in Bogotá (08:30 UTC).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'purge-notifications',
  '30 8 * * *',
  $$select private.purge_notifications()$$
);
