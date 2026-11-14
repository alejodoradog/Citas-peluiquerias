-- "Mis citas", migrations add_my_appointments_type and add_my_appointments.
--
-- - Only the app's server asks for the email; it is queued only for a
--   customer with upcoming appointments, 3 an hour at most, and the IP is
--   limited. Nothing tells whether an email exists.
-- - The link lives 24 hours and opens the upcoming appointments of that
--   customer in that barbershop, without email or phone.
-- - From the list, a link of each appointment, only of that customer.
-- - The email goes to the customer of the payload, never to someone else.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000062aa', 'owner-m@example.com');
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on) values
  ('aaaaaaaa-0000-0000-0000-000000000062', 'Barbería M', 'mis-citas-m', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10);
insert into public.profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-0000000062aa', 'Dueño M', '+573001112233');
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-0000000062aa', 'aaaaaaaa-0000-0000-0000-000000000062', 'owner');
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000062', 'aaaaaaaa-0000-0000-0000-000000000062', 'Corte', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order) values
  ('ba000000-0000-0000-0000-000000000062', 'aaaaaaaa-0000-0000-0000-000000000062', 'Uno',
   encode(sha256(convert_to('Uno mis citas', 'UTF8')), 'hex'), 1);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000062', 'ba000000-0000-0000-0000-000000000062', '5e000000-0000-0000-0000-000000000062');
insert into public.customers (id, barbershop_id, full_name, email, phone) values
  ('c0000000-0000-0000-0000-000000000621', 'aaaaaaaa-0000-0000-0000-000000000062', 'Camila Rojas', 'camila@example.com', '+573001234567'),
  ('c0000000-0000-0000-0000-000000000622', 'aaaaaaaa-0000-0000-0000-000000000062', 'Sin Citas', 'sin@example.com', null);
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source) values
  ('e0000000-0000-0000-0000-000000000621', 'aaaaaaaa-0000-0000-0000-000000000062', 'c0000000-0000-0000-0000-000000000621',
   'ba000000-0000-0000-0000-000000000062', now() + interval '2 days', now() + interval '2 days 30 minutes', 25000, 'web'),
  ('e0000000-0000-0000-0000-000000000622', 'aaaaaaaa-0000-0000-0000-000000000062', 'c0000000-0000-0000-0000-000000000621',
   'ba000000-0000-0000-0000-000000000062', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 25000, 'web');
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000062', 'e0000000-0000-0000-0000-000000000621', 1, '5e000000-0000-0000-0000-000000000062'),
  ('aaaaaaaa-0000-0000-0000-000000000062', 'e0000000-0000-0000-0000-000000000622', 1, '5e000000-0000-0000-0000-000000000062');
delete from public.notifications;

create function pg_temp.hint_of(statement text)
returns text
language plpgsql
as $$
declare
  error_hint text;
begin
  execute statement;
  return 'no error';
exception when others then
  if sqlstate = '42501' then
    return sqlstate;
  end if;
  get stacked diagnostics error_hint = pg_exception_hint;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;
grant execute on function pg_temp.hint_of(text) to anon, authenticated, service_role;

create function pg_temp.h(word text)
returns text
language sql
immutable
as $$ select encode(sha256(convert_to(word, 'UTF8')), 'hex') $$;
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;

-- Privileges ------------------------------------------------------------------------------------------

select ok(
  has_function_privilege('service_role', 'public.request_my_appointments(uuid, text, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.request_my_appointments(uuid, text, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.request_my_appointments(uuid, text, text)', 'EXECUTE'),
  'only the app''s server asks for the email (after Turnstile)'
);
select ok(
  has_function_privilege('service_role', 'public.issue_customer_link(uuid, uuid, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.issue_customer_link(uuid, uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.issue_customer_link(uuid, uuid, text)', 'EXECUTE'),
  'and only the server key keeps a link'
);
select ok(
  not has_table_privilege('anon', 'private.customer_links', 'SELECT')
    and not has_table_privilege('service_role', 'private.customer_links', 'SELECT')
    and not has_table_privilege('authenticated', 'private.my_appointments_hits', 'SELECT'),
  'nobody reads the links or the hits'
);

-- Asking -------------------------------------------------------------------------------------------

set local role service_role;
select is(pg_temp.hint_of($$select public.request_my_appointments('aaaaaaaa-0000-0000-0000-000000000062', ' Camila@Example.com ', pg_temp.h('ip 1'))$$),
  'no error', 'a customer asks for their link');
select is(pg_temp.hint_of($$select public.request_my_appointments('aaaaaaaa-0000-0000-0000-000000000062', 'nadie@example.com', pg_temp.h('ip 1'))$$),
  'no error', 'an unknown email gets the same answer');
select is(pg_temp.hint_of($$select public.request_my_appointments('aaaaaaaa-0000-0000-0000-000000000062', 'sin@example.com', pg_temp.h('ip 1'))$$),
  'no error', 'and so does a customer with nothing upcoming');
reset role;
select is(
  (select array_agg(payload ->> 'customer_id') from public.notifications where type = 'customer_appointments'),
  array['c0000000-0000-0000-0000-000000000621'],
  'only the customer with upcoming appointments gets an email'
);
select is(
  private.notification_recipient((select id from public.notifications where type = 'customer_appointments')),
  'camila@example.com', 'sent to that customer'
);

set local role service_role;
select pg_temp.hint_of($$select public.request_my_appointments('aaaaaaaa-0000-0000-0000-000000000062', 'camila@example.com', pg_temp.h('ip 2'))$$);
select pg_temp.hint_of($$select public.request_my_appointments('aaaaaaaa-0000-0000-0000-000000000062', 'camila@example.com', pg_temp.h('ip 2'))$$);
select pg_temp.hint_of($$select public.request_my_appointments('aaaaaaaa-0000-0000-0000-000000000062', 'camila@example.com', pg_temp.h('ip 2'))$$);
reset role;
select is(
  (select count(*)::int from public.notifications where type = 'customer_appointments'),
  3, 'at most 3 emails an hour per customer'
);
set local role service_role;
select pg_temp.hint_of($$select public.request_my_appointments('aaaaaaaa-0000-0000-0000-000000000062', 'x@example.com', pg_temp.h('ip 2'))$$);
select pg_temp.hint_of($$select public.request_my_appointments('aaaaaaaa-0000-0000-0000-000000000062', 'x@example.com', pg_temp.h('ip 2'))$$);
select is(pg_temp.hint_of($$select public.request_my_appointments('aaaaaaaa-0000-0000-0000-000000000062', 'x@example.com', pg_temp.h('ip 2'))$$),
  'too_many_from_ip', 'and 5 requests an hour per place');

-- The link -------------------------------------------------------------------------------------------

select is(pg_temp.hint_of($$select public.issue_customer_link('aaaaaaaa-0000-0000-0000-000000000062', 'c0000000-0000-0000-0000-000000000621', pg_temp.h('lista'))$$),
  'no error', 'the server key keeps the hash of the email''s link');
select is(pg_temp.hint_of($$select public.issue_customer_link(gen_random_uuid(), 'c0000000-0000-0000-0000-000000000621', pg_temp.h('otra'))$$),
  'P0002', 'never for a customer of another barbershop');
reset role;

set local role anon;
select is(
  (select array_agg(row(customer_first_name, appointment_id, service_names)::text)
   from public.my_appointments(pg_temp.h('lista'))),
  array['(Camila,e0000000-0000-0000-0000-000000000621,{Corte})'],
  'the link lists the upcoming appointments of that customer, never past ones'
);
select is(
  (select count(*)::int from public.my_appointments(pg_temp.h('no existe'))),
  0, 'an unknown link lists nothing'
);
select is(pg_temp.hint_of($$select public.issue_my_appointment_link(pg_temp.h('lista'), 'e0000000-0000-0000-0000-000000000621', pg_temp.h('cita desde la lista'))$$),
  'no error', 'from the list, a link of each appointment');
select is(
  (select count(*)::int from public.managed_appointment(pg_temp.h('cita desde la lista'))),
  1, 'that opens the appointment (task 3.4)'
);
select is(pg_temp.hint_of($$select public.issue_my_appointment_link(pg_temp.h('lista'), 'e0000000-0000-0000-0000-000000000622', pg_temp.h('pasada'))$$),
  'link_invalid', 'never for a past appointment');
reset role;

update private.customer_links set expires_at = now() - interval '1 minute' where token_hash = pg_temp.h('lista');
set local role anon;
select is(
  (select count(*)::int from public.my_appointments(pg_temp.h('lista'))),
  0, 'after 24 hours the link lists nothing'
);
reset role;

select * from finish();
rollback;
