-- Task 5.2, migration add_email_events: a bounce or a complaint that Resend
-- reports is recorded on its message of the queue (record_email_event).
--
-- - Only the service key calls it: no session, anon or signed in.
-- - It keeps the code in last_error and leaves the status as it was.
-- - Any other event is refused; an unknown message changes nothing.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

select ok(
  has_function_privilege('service_role', 'public.record_email_event(uuid, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.record_email_event(uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.record_email_event(uuid, text)', 'EXECUTE'),
  'only the service key records an email event'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.record_email_event(uuid, text)'::regprocedure),
  'security definer with an empty search_path'
);

insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sede Correos', 'sede-correos', '+573001112233', current_date + 10, current_date + 10);

create temporary table ids (id uuid) on commit drop;
insert into ids
select private.enqueue_notification(
  'aaaaaaaa-0000-0000-0000-000000000001', 'subscription_expiring', 'expiring:prueba'
);
update public.notifications set status = 'sent', sent_at = now() where id = (select id from ids);

select is(
  public.record_email_event((select id from ids), 'bounced'),
  true,
  'a bounce of a known message is recorded'
);
select is(
  (select row(status, last_error)::text from public.notifications where id = (select id from ids)),
  '(sent,bounced)',
  'with its code, and the message stays sent'
);
select is(
  public.record_email_event((select id from ids), 'complained'),
  true,
  'a complaint replaces it'
);
select is(
  public.record_email_event(gen_random_uuid(), 'bounced'),
  false,
  'an unknown message changes nothing'
);
select throws_ok(
  $$select public.record_email_event((select id from ids), 'delivered')$$,
  '22023', null,
  'any other event is refused'
);

select * from finish();
rollback;
