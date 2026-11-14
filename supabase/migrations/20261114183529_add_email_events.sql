-- Task 5.2 (decision 0008, point 7): a bounce or a complaint that Resend
-- reports through its signed webhook (supabase/functions/resend-webhook) is
-- recorded on its message of the queue, as a short code in last_error. The
-- status stays as it was: the message did leave. Resend itself stops sending
-- to an address that bounced for good (decision E3), so there is no list of
-- our own.
--
-- Only the webhook calls it, with the service key: no session reaches it.

create function public.record_email_event(p_notification_id uuid, p_event text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_event is null or p_event not in ('bounced', 'complained') then
    raise exception 'unknown email event' using errcode = 'invalid_parameter_value';
  end if;
  update public.notifications
  set last_error = p_event
  where id = p_notification_id;
  return found;
end;
$$;

revoke all on function public.record_email_event(uuid, text) from public;
grant execute on function public.record_email_event(uuid, text) to service_role;
