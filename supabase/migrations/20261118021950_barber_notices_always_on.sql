-- Task 8.12 (docs/tareas/8.12-avisos-siempre.md): a professional's notices
-- are no longer a choice. It replaces answer 5 of decision 0010: the owner
-- cannot turn them off.
--
-- email_notifications now follows the email: on when the professional has an
-- email, off when not (the check barbers_notifications_need_email stays and
-- is always met). private.notification_recipient is not touched: it still
-- reads email_notifications.

-- 1. The column follows the email, on every insert and on every change of
--    either column, whoever writes it (an owner, an invitation, the setup).

create function private.barber_notices_follow_email()
returns trigger
language plpgsql
-- It only sets NEW: it needs no rights of its owner.
security invoker
set search_path = ''
as $$
begin
  new.email_notifications := new.email is not null;
  return new;
end;
$$;

revoke all on function private.barber_notices_follow_email() from public, anon, authenticated;

create trigger barber_notices_follow_email
  before insert or update of email, email_notifications on public.barbers
  for each row
  execute function private.barber_notices_follow_email();

-- 2. The professionals that already exist with an email and the notices off.
--    A deleted professional has no email (barbers_deleted_has_no_data), so
--    keep_deleted_barber never sees this update. It runs as the migration
--    role, not as 'staff', so limit_barber_updates_when_read_only lets it
--    through even for a paused barbershop.

update public.barbers
set email_notifications = true
where email is not null
  and not email_notifications
  and deleted_at is null;
