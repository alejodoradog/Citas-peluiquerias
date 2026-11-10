-- Task 1.6: local test data. Loaded by `supabase db reset`, never in the cloud.
-- Accounts, passwords and links are listed in docs/operacion/datos-de-prueba.md.
--
-- Owners sign up the same way the app does: an auth user with the
-- registration as metadata, so the signup trigger creates the barbershop and
-- the owner profile (decision 0004). Dates are relative to the day of the
-- reset, in Bogotá, so there are always appointments for today and tomorrow.

-- Guard: this seed creates a super admin with a public password. It only runs
-- on a freshly reset local database; a database with any account or
-- barbershop (any cloud project in use) makes it fail before inserting.
do $$
begin
  if exists (select 1 from auth.users) or exists (select 1 from public.barbershops) then
    raise exception 'seed.sql only runs on a freshly reset local database';
  end if;
end;
$$;

do $$
declare
  password_hash text := extensions.crypt('barberia-local-1', extensions.gen_salt('bf'));
  tz constant text := 'America/Bogota';
  today date := (now() at time zone 'America/Bogota')::date;
  -- Working days: both barbershops close on Sundays (dow 0).
  d0 date; d1 date; p1 date; p2 date;

  carlos uuid := 'd0000000-0000-4000-8000-000000000001';
  jose uuid := 'd0000000-0000-4000-8000-000000000002';
  admin uuid := 'd0000000-0000-4000-8000-000000000003';

  barrio uuid; donjose uuid;
  b_carlos uuid; b_andres uuid; b_jose uuid; b_mateo uuid;
  s_corte uuid; s_barba uuid; s_combo uuid; s_cejas uuid; s_ninos uuid;
  j_corte uuid; j_barba uuid; j_combo uuid;
  c_juan uuid; c_felipe uuid; c_santiago uuid; c_daniel uuid; c_miguel uuid;
  c_andrea uuid; c_luis uuid; c_camilo uuid;
  appt record; appt_id uuid;
begin
  d0 := case when extract(dow from today) = 0 then today + 1 else today end;
  d1 := case when extract(dow from d0 + 1) = 0 then d0 + 2 else d0 + 1 end;
  p1 := case when extract(dow from today - 1) = 0 then today - 2 else today - 1 end;
  p2 := case when extract(dow from p1 - 1) = 0 then p1 - 2 else p1 - 1 end;

  -- Accounts ----------------------------------------------------------------------

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', carlos, 'authenticated', 'authenticated',
     'carlos@barberias.test', password_hash, now(),
     '{"provider": "email", "providers": ["email"]}',
     '{"owner_name": "Carlos Pérez", "barbershop_name": "La Barbería del Barrio",
       "barbershop_slug": "la-barberia-del-barrio", "phone": "+573001234567"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', jose, 'authenticated', 'authenticated',
     'jose@barberias.test', password_hash, now(),
     '{"provider": "email", "providers": ["email"]}',
     '{"owner_name": "José Rodríguez", "barbershop_name": "Barbería Don José",
       "barbershop_slug": "barberia-don-jose", "phone": "+573157654321"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', admin, 'authenticated', 'authenticated',
     'admin@barberias.test', password_hash, now(),
     '{"provider": "email", "providers": ["email"]}', '{}',
     now(), now(), '', '', '', '');

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
  from auth.users u
  where u.id in (carlos, jose, admin);

  -- Super admins are never created by signup (docs/operacion/crear-super-admin.md).
  insert into public.profiles (id, full_name, is_super_admin)
  values (admin, 'Admin Plataforma', true);

  select id into barrio from public.barbershops where slug = 'la-barberia-del-barrio';
  select id into donjose from public.barbershops where slug = 'barberia-don-jose';

  -- Barbershop profiles -----------------------------------------------------------

  update public.barbershops set
    address = 'Calle 45 # 13-20, Chapinero, Bogotá',
    latitude = 4.6371, longitude = -74.0650,
    deposit_method = 'nequi', deposit_account = '300 123 4567'
  where id = barrio;

  -- Don José already paid: his trial ended 6 days ago and he paid the next day,
  -- so one month counts from the payment day (decision 0006, single plan).
  update public.barbershops set
    address = 'Carrera 70 # 32-15, Laureles, Medellín',
    latitude = 6.2443, longitude = -75.5906,
    subscription_status = 'active', plan = 'standard',
    trial_ends_on = today - 6,
    expires_on = ((today - 5) + interval '1 month')::date - 1,
    cancellation_notice_hours = 3
  where id = donjose;

  insert into public.subscription_payments (
    barbershop_id, plan, amount_cop, method, reference,
    paid_on, covers_from, covers_until, registered_by
  ) values (
    donjose, 'standard', 25000, 'nequi', 'NEQUI-DEMO-001',
    today - 5, today - 5, ((today - 5) + interval '1 month')::date - 1, admin
  );

  -- Opening hours: Monday to Saturday ------------------------------------------------

  insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
  select barrio, day, shift.start_time, shift.end_time
  from generate_series(1, 6) as day
  cross join (values (time '09:00', time '13:00'), (time '14:00', time '19:00'))
    as shift (start_time, end_time);

  insert into public.barbershop_hours (barbershop_id, weekday, start_time, end_time)
  select donjose, day, time '08:00', time '18:00'
  from generate_series(1, 6) as day;

  -- Barbers ---------------------------------------------------------------------------
  -- Link tokens are known on purpose, for local testing of "Mi agenda" (4.4).

  insert into public.barbers (barbershop_id, display_name, email, link_token_hash, sort_order)
  values (barrio, 'Carlos', 'carlos@barberias.test',
          encode(extensions.digest('demo-barbero-carlos', 'sha256'), 'hex'), 1)
  returning id into b_carlos;
  insert into public.barbers (barbershop_id, display_name, link_token_hash, sort_order)
  values (barrio, 'Andrés',
          encode(extensions.digest('demo-barbero-andres', 'sha256'), 'hex'), 2)
  returning id into b_andres;
  insert into public.barbers (barbershop_id, display_name, email, link_token_hash, sort_order)
  values (donjose, 'José', 'jose@barberias.test',
          encode(extensions.digest('demo-barbero-jose', 'sha256'), 'hex'), 1)
  returning id into b_jose;
  insert into public.barbers (
    barbershop_id, display_name, email, link_token_hash, email_notifications, sort_order
  ) values (donjose, 'Mateo', 'mateo@barberias.test',
            encode(extensions.digest('demo-barbero-mateo', 'sha256'), 'hex'), true, 2)
  returning id into b_mateo;

  -- Each barber works the barbershop's hours.
  insert into public.barber_schedules (barbershop_id, barber_id, weekday, start_time, end_time)
  select h.barbershop_id, b.id, h.weekday, h.start_time, h.end_time
  from public.barbershop_hours h
  join public.barbers b on b.barbershop_id = h.barbershop_id
  where h.barbershop_id in (barrio, donjose);
  -- Their own rows, copied from the barbershop: they count only with the flag off.
  update public.barbers set uses_barbershop_hours = false
  where barbershop_id in (barrio, donjose);

  -- Services: the typical ones the spec suggests ------------------------------------

  insert into public.services (barbershop_id, name, price_cop, duration_minutes)
  values (barrio, 'Corte', 25000, 40) returning id into s_corte;
  insert into public.services (barbershop_id, name, price_cop, duration_minutes)
  values (barrio, 'Barba', 15000, 20) returning id into s_barba;
  insert into public.services (barbershop_id, name, price_cop, duration_minutes)
  values (barrio, 'Corte + barba', 35000, 60) returning id into s_combo;
  insert into public.services (barbershop_id, name, price_cop, duration_minutes)
  values (barrio, 'Cejas', 8000, 10) returning id into s_cejas;
  insert into public.services (barbershop_id, name, price_cop, duration_minutes)
  values (barrio, 'Corte niños', 20000, 30) returning id into s_ninos;

  insert into public.services (barbershop_id, name, price_cop, duration_minutes)
  values (donjose, 'Corte', 30000, 40) returning id into j_corte;
  insert into public.services (barbershop_id, name, price_cop, duration_minutes)
  values (donjose, 'Barba', 18000, 20) returning id into j_barba;
  insert into public.services (barbershop_id, name, price_cop, duration_minutes)
  values (donjose, 'Corte + barba', 42000, 60) returning id into j_combo;
  insert into public.services (barbershop_id, name, price_cop, duration_minutes)
  values (donjose, 'Cejas', 10000, 10), (donjose, 'Corte niños', 22000, 30);

  -- Every barber does every service of their barbershop.
  insert into public.barber_services (barbershop_id, barber_id, service_id)
  select b.barbershop_id, b.id, s.id
  from public.barbers b
  join public.services s on s.barbershop_id = b.barbershop_id
  where b.barbershop_id in (barrio, donjose);

  -- Blocked time ------------------------------------------------------------------

  insert into public.time_blocks (barbershop_id, barber_id, starts_at, ends_at, reason)
  values
    (barrio, b_andres, (d1 + time '15:00') at time zone tz, (d1 + time '16:00') at time zone tz,
     'Diligencia'),
    (donjose, null, (today + 7 + time '08:00') at time zone tz,
     (today + 7 + time '18:00') at time zone tz, 'Capacitación del equipo');

  -- Customers ----------------------------------------------------------------------

  -- Email is the channel; the phone is optional, and a customer who only has
  -- manual appointments may have just a name (Camilo, who walked in).
  insert into public.customers (barbershop_id, full_name, email, phone)
  values (barrio, 'Juan Gómez', 'juan@clientes.test', '+573101112233') returning id into c_juan;
  insert into public.customers (barbershop_id, full_name, email, phone, notes)
  values (barrio, 'Felipe Ramírez', 'felipe@clientes.test', '+573112223344', 'Le gusta el degradado bajo.')
  returning id into c_felipe;
  insert into public.customers (barbershop_id, full_name, email)
  values (barrio, 'Santiago López', 'santiago@clientes.test') returning id into c_santiago;
  insert into public.customers (barbershop_id, full_name, email)
  values (barrio, 'Daniel Torres', 'daniel@clientes.test') returning id into c_daniel;
  insert into public.customers (barbershop_id, full_name, email)
  values (barrio, 'Miguel Ángel Castro', 'miguel@clientes.test') returning id into c_miguel;
  insert into public.customers (barbershop_id, full_name, email, phone)
  values (donjose, 'Andrea Restrepo', 'andrea@clientes.test', '+573156667788') returning id into c_andrea;
  insert into public.customers (barbershop_id, full_name, email)
  values (donjose, 'Luis Fernando Mejía', 'luis@clientes.test') returning id into c_luis;
  insert into public.customers (barbershop_id, full_name)
  values (donjose, 'Camilo Ochoa') returning id into c_camilo;

  -- Appointments ------------------------------------------------------------------
  -- Created like the app does, with create_appointment (decision 0006): length
  -- and price come from the services, and an appointment may have several.
  -- Closed ones are then moved to their status, which leaves their history.

  for appt in
    select * from (values
      -- Two days ago: Juan did not show up (first time).
      (barrio, p2, time '10:00', c_juan, b_carlos, array[s_corte], 'no_show', 'web'),
      (barrio, p2, time '15:00', c_santiago, b_andres, array[s_corte], 'attended', 'web'),
      -- Yesterday: Juan did not show up again; Felipe came.
      (barrio, p1, time '10:00', c_juan, b_carlos, array[s_corte], 'no_show', 'web'),
      (barrio, p1, time '11:00', c_felipe, b_andres, array[s_combo], 'attended', 'manual'),
      -- Today.
      (barrio, d0, time '10:00', c_daniel, b_carlos, array[s_corte], 'confirmed', 'web'),
      (barrio, d0, time '15:00', c_felipe, b_andres, array[s_barba], 'confirmed', 'web'),
      (barrio, d0, time '16:00', c_miguel, b_carlos, array[s_cejas], 'cancelled_by_customer', 'web'),
      -- Tomorrow, one of them with two services in one booking.
      (barrio, d1, time '09:00', c_santiago, b_andres, array[s_ninos], 'confirmed', 'manual'),
      (barrio, d1, time '11:00', c_daniel, b_carlos, array[s_corte, s_barba], 'confirmed', 'web'),
      (barrio, d1, time '17:00', c_juan, b_carlos, array[s_corte], 'confirmed', 'web'),
      -- Barbería Don José.
      (donjose, p1, time '09:00', c_andrea, b_jose, array[j_corte], 'attended', 'web'),
      (donjose, d0, time '11:00', c_luis, b_mateo, array[j_combo], 'confirmed', 'web'),
      (donjose, d0, time '14:00', c_camilo, b_jose, array[j_barba], 'cancelled_by_barbershop', 'manual'),
      (donjose, d1, time '10:00', c_andrea, b_mateo, array[j_corte], 'confirmed', 'web')
    ) as a (barbershop_id, day, start_time, customer_id, barber_id, service_ids, status, source)
  loop
    appt_id := public.create_appointment(
      appt.barbershop_id, appt.customer_id, appt.barber_id,
      (appt.day + appt.start_time) at time zone tz,
      appt.service_ids, appt.source::public.appointment_source
    );
    if appt.status <> 'confirmed' then
      update public.appointments
      set status = appt.status::public.appointment_status
      where id = appt_id;
    end if;
  end loop;
end;
$$;
