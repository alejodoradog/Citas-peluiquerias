-- Task 1.1: the 13 tables of the data model.
-- See docs/decisiones/0001-modelo-de-datos.md.
--
-- Conventions:
-- - Every business table carries barbershop_id. Children reference their
--   parents through (barbershop_id, id), so a row of barbershop A can never
--   point at a row of barbershop B.
-- - Row level security is enabled on every table with no policies yet: nothing
--   is readable or writable through the API until task 1.2 adds policies.
-- - Instants are timestamptz (UTC). Calendar dates are date and wall clock
--   times are time, both in America/Bogota.
-- - Money is whole Colombian pesos (integer).
-- - History is never cascade-deleted.

-- barbershops: tenant root ----------------------------------------------------

create table public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  logo_path text,
  cover_photo_path text,
  address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  whatsapp_phone text check (private.is_e164_phone(whatsapp_phone)),
  min_booking_notice_minutes integer not null default 60
    check (min_booking_notice_minutes between 0 and 10080),
  cancellation_notice_hours integer not null default 2
    check (cancellation_notice_hours between 0 and 168),
  deposit_method public.payment_method,
  deposit_account text check (char_length(btrim(deposit_account)) between 1 and 100),
  subscription_status public.subscription_status not null default 'trial',
  -- Empty during the free trial; set when the first payment is registered.
  plan public.subscription_plan,
  -- Last day of service in America/Bogota, trial included.
  expires_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barbershops_coordinates_together
    check ((latitude is null) = (longitude is null)),
  constraint barbershops_deposit_together
    check ((deposit_method is null) = (deposit_account is null)),
  -- Deposits go to Nequi, Daviplata or a Bre-B key, not a bank account.
  constraint barbershops_deposit_method
    check (deposit_method <> 'bank_transfer'),
  constraint barbershops_active_has_plan
    check (subscription_status <> 'active' or plan is not null)
);

create index barbershops_subscription_idx
  on public.barbershops (subscription_status, expires_on);

-- profiles: owner and super admin accounts (spec: usuarios) -----------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  barbershop_id uuid references public.barbershops (id) on delete restrict,
  role public.user_role not null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  phone text check (private.is_e164_phone(phone)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_matches_barbershop
    check ((role = 'super_admin') = (barbershop_id is null))
);

-- One owner account per barbershop.
create unique index profiles_one_owner_per_barbershop
  on public.profiles (barbershop_id)
  where role = 'owner';

-- barbers ---------------------------------------------------------------------

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  photo_path text,
  phone text check (private.is_e164_phone(phone)),
  link_token_hash text not null unique check (private.is_token_hash(link_token_hash)),
  link_active boolean not null default true,
  whatsapp_notifications boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id, id),
  constraint barbers_notifications_need_phone
    check (not whatsapp_notifications or phone is not null)
);

-- barber_schedules: weekly hours per barber (spec: horarios_barbero) ---------------

create table public.barber_schedules (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null,
  barber_id uuid not null,
  -- 0 is Sunday and 6 is Saturday, as in src/lib/fechas.
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (barbershop_id, barber_id)
    references public.barbers (barbershop_id, id) on delete cascade,
  constraint barber_schedules_time_order check (start_time < end_time)
);

create index barber_schedules_barber_idx
  on public.barber_schedules (barbershop_id, barber_id, weekday);

-- barbershop_hours: weekly opening hours, split shifts allowed --------------------

create table public.barbershop_hours (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barbershop_hours_time_order check (start_time < end_time)
);

create index barbershop_hours_barbershop_idx
  on public.barbershop_hours (barbershop_id, weekday);

-- holiday_openings: holidays a barbershop opens on --------------------------------
-- Holidays are closed by default. A row means the barbershop opens that day
-- with its regular hours for that weekday. Holidays come from src/lib/fechas.

create table public.holiday_openings (
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  holiday_date date not null,
  created_at timestamptz not null default now(),
  primary key (barbershop_id, holiday_date)
);

-- services --------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  price_cop integer not null check (price_cop >= 0),
  duration_minutes integer not null check (duration_minutes between 1 and 720),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id, id)
);

-- barber_services: services each barber offers (spec: barbero_servicio) -----------

create table public.barber_services (
  barbershop_id uuid not null,
  barber_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (barbershop_id, barber_id, service_id),
  foreign key (barbershop_id, barber_id)
    references public.barbers (barbershop_id, id) on delete cascade,
  foreign key (barbershop_id, service_id)
    references public.services (barbershop_id, id) on delete cascade
);

create index barber_services_service_idx
  on public.barber_services (barbershop_id, service_id);

-- time_blocks: blocked time for one barber or, without barber, the whole shop -----
-- (spec: bloqueos; covers lunch, leave and special closures)

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  barber_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (barbershop_id, barber_id)
    references public.barbers (barbershop_id, id) on delete restrict,
  constraint time_blocks_time_order check (starts_at < ends_at)
);

create index time_blocks_barbershop_idx
  on public.time_blocks (barbershop_id, starts_at);

create index time_blocks_barber_idx
  on public.time_blocks (barbershop_id, barber_id, starts_at);

-- customers (spec: clientes) --------------------------------------------------------
-- Visits and no-shows are derived from appointments, not stored.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  phone text not null check (private.is_e164_phone(phone)),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id, id),
  unique (barbershop_id, phone)
);

-- appointments (spec: citas) ---------------------------------------------------------
-- The no-overlap exclusion constraint arrives in task 1.3.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  customer_id uuid not null,
  barber_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Price at booking time, so later price changes do not rewrite history.
  price_cop integer not null check (price_cop >= 0),
  status public.appointment_status not null default 'confirmed',
  source public.appointment_source not null,
  deposit_received boolean not null default false,
  manage_token_hash text unique check (private.is_token_hash(manage_token_hash)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id, id),
  foreign key (barbershop_id, customer_id)
    references public.customers (barbershop_id, id) on delete restrict,
  foreign key (barbershop_id, barber_id)
    references public.barbers (barbershop_id, id) on delete restrict,
  foreign key (barbershop_id, service_id)
    references public.services (barbershop_id, id) on delete restrict,
  constraint appointments_time_order check (starts_at < ends_at)
);

create index appointments_barbershop_starts_idx
  on public.appointments (barbershop_id, starts_at);

create index appointments_barber_starts_idx
  on public.appointments (barbershop_id, barber_id, starts_at);

create index appointments_customer_starts_idx
  on public.appointments (barbershop_id, customer_id, starts_at);

create index appointments_service_idx
  on public.appointments (barbershop_id, service_id);

-- notifications: outgoing message queue (spec: notificaciones) ---------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  appointment_id uuid,
  type public.notification_type not null,
  channel public.notification_channel not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  -- One key per logical message, so a retry never sends it twice.
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id, dedupe_key),
  foreign key (barbershop_id, appointment_id)
    references public.appointments (barbershop_id, id) on delete restrict,
  constraint notifications_sent_has_time
    check ((status = 'sent') = (sent_at is not null))
);

create index notifications_pending_idx
  on public.notifications (scheduled_for)
  where status = 'pending';

create index notifications_appointment_idx
  on public.notifications (barbershop_id, appointment_id);

-- subscription_payments (spec: pagos_suscripcion) ---------------------------------

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete restrict,
  plan public.subscription_plan not null,
  billing_period public.billing_period not null,
  amount_cop integer not null check (amount_cop > 0),
  method public.payment_method not null,
  reference text not null check (char_length(btrim(reference)) between 1 and 100),
  paid_on date not null,
  covers_from date not null,
  covers_until date not null,
  registered_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint subscription_payments_period_order check (covers_from < covers_until)
);

create index subscription_payments_barbershop_idx
  on public.subscription_payments (barbershop_id, paid_on desc);

create index subscription_payments_registered_by_idx
  on public.subscription_payments (registered_by);

-- updated_at --------------------------------------------------------------------

create trigger set_updated_at before update on public.barbershops
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.barbers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.barber_schedules
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.barbershop_hours
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.time_blocks
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.notifications
  for each row execute function private.set_updated_at();

-- Row level security: closed until task 1.2 adds policies ------------------------

alter table public.barbershops enable row level security;
alter table public.profiles enable row level security;
alter table public.barbers enable row level security;
alter table public.barber_schedules enable row level security;
alter table public.barbershop_hours enable row level security;
alter table public.holiday_openings enable row level security;
alter table public.services enable row level security;
alter table public.barber_services enable row level security;
alter table public.time_blocks enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;
alter table public.subscription_payments enable row level security;
