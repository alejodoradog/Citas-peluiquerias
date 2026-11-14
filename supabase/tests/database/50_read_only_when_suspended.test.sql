-- Task 5.5, migration read_only_when_suspended (decision 0006, "### 10.").
--
-- - awaiting_first_payment: configuring works, creating appointments fails.
-- - Suspended:
--   - the owner and the barber close appointments (attended, no_show);
--   - the barber does not cancel; the customer cancels, but neither marks
--     nor moves; a system actor changes nothing;
--   - no appointment, service change, block or configuration change, also
--     through the security definer functions of task 4.2.
-- - Another sede of the same owner stays writable.
-- - The fifth day of grace is active and the sixth is expired.
-- - The data stays readable.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

-- Fixtures, inserted as the table owner -------------------------------------------------------

create function pg_temp.h(token text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;

-- The instant of hh:mm Bogotá, `days` days from today in Bogotá.
create function pg_temp.at(days integer, hhmm text)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'America/Bogota')::date + days) + hhmm::time) at time zone 'America/Bogota'
$$;

-- The first day from the day after tomorrow that is not a holiday, as days
-- from today: the 4.2 functions refuse a closed holiday first.
select set_config('test.workday', (
  select min(d)::text
  from generate_series(2, 9) d
  where not private.is_colombian_holiday(private.today_bogota() + d)
), true);

create function pg_temp.workday()
returns integer
language sql
stable
as $$
  select current_setting('test.workday')::integer
$$;

-- The hint of the error a statement raises (or its SQLSTATE), or 'no error'.
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
  get stacked diagnostics error_hint = pg_exception_hint;
  return coalesce(nullif(error_hint, ''), sqlstate);
end;
$$;

grant execute on function pg_temp.h(text), pg_temp.at(integer, text), pg_temp.workday(), pg_temp.hint_of(text)
  to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dueno-a@example.com');
insert into public.profiles (id, full_name, phone, is_super_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Dueño A', '+573001112233', false);

-- S1 is suspended below; S2 is another sede of the same owner; S3 was created
-- after the trial ended and waits for its first payment.
insert into public.barbershops (id, name, slug, whatsapp_phone, trial_ends_on, expires_on, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sede Uno', 'sede-uno-pausa', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Sede Dos', 'sede-dos-pausa', '+573001112233',
   private.today_bogota() + 10, private.today_bogota() + 10, now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sede Tres', 'sede-tres-pausa', '+573001112233',
   private.today_bogota() - 1, private.today_bogota() - 1, now());
insert into public.memberships (user_id, barbershop_id, role)
select '00000000-0000-0000-0000-00000000000a', id, 'owner'
from public.barbershops where slug like 'sede-%-pausa';
insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
select b.id, d, '06:00', '22:00'
from public.barbershops b, generate_series(0, 6) d
where b.slug like 'sede-%-pausa';
insert into public.services (id, barbershop_id, name, price_cop, duration_minutes, active) values
  ('5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Barba', 15000, 30, true),
  ('5e000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Corte', 25000, 30, true),
  ('5e000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003', 'Corte', 25000, 30, true);
insert into public.barbers (id, barbershop_id, display_name, link_token_hash, sort_order) values
  ('ba000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Uno', pg_temp.h('barbero-uno'), 1),
  ('ba000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Dos', pg_temp.h('barbero-dos'), 1),
  ('ba000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', 'Tres', pg_temp.h('barbero-tres'), 1);
insert into public.barber_services (barbershop_id, barber_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'ba000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'ba000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000004');
insert into public.customers (id, barbershop_id, full_name, email) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cliente Uno', 'cliente@example.com');

-- In S1: two that started (a1, a2) and two tomorrow (a3 with the customer's
-- link, a4).
insert into public.appointments (id, barbershop_id, customer_id, barber_id, starts_at, ends_at, price_cop, source, manage_token_hash) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', now() - interval '60 minutes', now() - interval '30 minutes', 25000, 'manual', null),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', now() - interval '30 minutes', now(), 25000, 'manual', null),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '10:00'), pg_temp.at(1, '10:30'), 25000, 'web', pg_temp.h('cita-tres')),
  ('a0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ba000000-0000-0000-0000-000000000001', pg_temp.at(1, '12:00'), pg_temp.at(1, '12:30'), 25000, 'manual', null);
insert into public.appointment_services (barbershop_id, appointment_id, position, service_id, price_cop, duration_minutes)
select 'aaaaaaaa-0000-0000-0000-000000000001', a.id, 1, '5e000000-0000-0000-0000-000000000001', 25000, 30
from public.appointments a where a.barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- The phase (decision 0006): the fifth day of grace and the sixth.
select is(
  private.barbershop_phase('active', 'standard', private.today_bogota() - 40, private.today_bogota() - 5, private.today_bogota() - 60),
  'active', 'the fifth day of grace is still active');
select is(
  private.barbershop_phase('active', 'standard', private.today_bogota() - 40, private.today_bogota() - 6, private.today_bogota() - 60),
  'expired', 'the sixth day is expired');
select is(private.phase_of('aaaaaaaa-0000-0000-0000-000000000003'), 'awaiting_first_payment',
  'a sede created after the trial waits for its first payment');

update public.barbershops set subscription_status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- The owner, with S1 suspended -----------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select count(*)::integer from public.appointments where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  4, 'the data of a suspended barbershop stays readable');
select is(
  pg_temp.hint_of($$select public.set_appointment_status('a0000000-0000-0000-0000-000000000001', 'attended')$$),
  'no error', 'the owner marks an appointment attended');
select is(
  pg_temp.hint_of($$select public.set_appointment_status('a0000000-0000-0000-0000-000000000004', 'cancelled_by_barbershop')$$),
  'barbershop_read_only', 'but does not cancel one');
select is(
  pg_temp.hint_of($$select public.create_manual_appointment('aaaaaaaa-0000-0000-0000-000000000001',
    'ba000000-0000-0000-0000-000000000001', pg_temp.at(pg_temp.workday(), '10:00'), array['5e000000-0000-0000-0000-000000000001']::uuid[],
    'c0000000-0000-0000-0000-000000000001', null, null, null)$$),
  'barbershop_read_only', 'nor creates a manual appointment');
select is(
  pg_temp.hint_of($$select public.reschedule_appointment('a0000000-0000-0000-0000-000000000004',
    'ba000000-0000-0000-0000-000000000001', pg_temp.at(pg_temp.workday(), '15:00'))$$),
  'barbershop_read_only', 'nor moves one');
select is(
  pg_temp.hint_of($$select public.change_appointment_services_checked('a0000000-0000-0000-0000-000000000004',
    array['5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002']::uuid[])$$),
  'barbershop_read_only', 'nor changes its services');
select is(
  pg_temp.hint_of($$select public.create_time_block('aaaaaaaa-0000-0000-0000-000000000001',
    'ba000000-0000-0000-0000-000000000001', pg_temp.at(pg_temp.workday(), '08:00'), pg_temp.at(pg_temp.workday(), '09:00'), 'Almuerzo')$$),
  'barbershop_read_only', 'nor blocks hours of a barber');
select isnt(
  pg_temp.hint_of($$insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at)
    values ('aaaaaaaa-0000-0000-0000-000000000001', null, pg_temp.at(3, '08:00'), pg_temp.at(3, '20:00'))$$),
  'no error', 'nor closes the barbershop');
update public.services set price_cop = 1 where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.barbershops set commission_percent = 40 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(
  (select row(min(s.price_cop), b.commission_percent)::text
   from public.services s join public.barbershops b on b.id = s.barbershop_id
   where s.barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   group by b.commission_percent),
  '(15000,0)', 'nor changes its services or its settings');
select isnt(
  pg_temp.hint_of($$select public.set_barbershop_hours('aaaaaaaa-0000-0000-0000-000000000001',
    '[{"weekday": 1, "start": "09:00", "end": "18:00"}]'::jsonb)$$),
  'no error', 'nor its hours');

-- Another sede of the same owner, and one awaiting its first payment.
update public.services set price_cop = 30000 where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002';
select is(
  (select price_cop from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  30000, 'another sede of the same owner stays writable');
select is(
  pg_temp.hint_of($$select public.create_time_block('aaaaaaaa-0000-0000-0000-000000000002',
    'ba000000-0000-0000-0000-000000000002', pg_temp.at(pg_temp.workday(), '08:00'), pg_temp.at(pg_temp.workday(), '09:00'), 'Almuerzo')$$),
  'no error', 'and takes blocks');
update public.services set price_cop = 28000 where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000003';
select is(
  (select price_cop from public.services where barbershop_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  28000, 'a sede awaiting its first payment can be configured');
select is(
  pg_temp.hint_of($$select public.create_time_block('aaaaaaaa-0000-0000-0000-000000000003',
    'ba000000-0000-0000-0000-000000000003', pg_temp.at(pg_temp.workday(), '08:00'), pg_temp.at(pg_temp.workday(), '09:00'), 'Almuerzo')$$),
  'no error', 'and its owner blocks hours (decision S5)');
select is(
  pg_temp.hint_of($$select public.create_manual_appointment('aaaaaaaa-0000-0000-0000-000000000003',
    'ba000000-0000-0000-0000-000000000003', pg_temp.at(pg_temp.workday(), '10:00'), array['5e000000-0000-0000-0000-000000000004']::uuid[],
    null, 'Cliente Nuevo', null, null)$$),
  'barbershop_read_only', 'but takes no appointment');

-- The barber and the customer, by their links -----------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  pg_temp.hint_of($$select public.mark_appointment_by_barber(pg_temp.h('barbero-uno'), 'a0000000-0000-0000-0000-000000000002', 'no_show')$$),
  'no error', 'the barber marks a no-show');
select is(
  pg_temp.hint_of($$select public.cancel_appointment_by_token(pg_temp.h('cita-tres'))$$),
  'no error', 'the customer cancels their appointment');
select isnt(
  pg_temp.hint_of($$select public.reschedule_appointment_by_token(pg_temp.h('cita-tres'), pg_temp.at(pg_temp.workday(), '10:00'))$$),
  'no error', 'but does not move it');
select is(public.barbershop_accepts_bookings('aaaaaaaa-0000-0000-0000-000000000001'), false,
  'the public page takes no booking');

-- The actor rules of the trigger, for any path ------------------------------------------------------

reset role;
select set_config('yapoin.actor', 'barber', true);
select is(
  pg_temp.hint_of($$update public.appointments set status = 'cancelled_by_barbershop' where id = 'a0000000-0000-0000-0000-000000000004'$$),
  'barbershop_read_only', 'a barber never cancels');
select set_config('yapoin.actor', 'customer', true);
select is(
  pg_temp.hint_of($$update public.appointments set status = 'attended' where id = 'a0000000-0000-0000-0000-000000000004'$$),
  'barbershop_read_only', 'a customer never marks attended');
select set_config('yapoin.actor', '', true);
select is(
  pg_temp.hint_of($$update public.appointments set status = 'attended' where id = 'a0000000-0000-0000-0000-000000000004'$$),
  'barbershop_read_only', 'a system actor changes nothing');

-- Paying lifts it all.
update public.barbershops set subscription_status = 'trial' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(
  pg_temp.hint_of($$update public.appointments set status = 'attended' where id = 'a0000000-0000-0000-0000-000000000004'$$),
  'no error', 'an active barbershop changes again');

select * from finish();
rollback;
