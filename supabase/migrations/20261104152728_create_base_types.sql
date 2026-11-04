-- Task 1.1: shared types and helpers for the data model.
-- See docs/decisiones/0001-modelo-de-datos.md.

-- Helpers live outside public, which the Supabase API exposes.
create schema if not exists private;
revoke all on schema private from public;

-- Validation helpers used by check constraints ---------------------------------

-- Phones are stored normalized as E.164, e.g. +573001234567.
create function private.is_e164_phone(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~ '^\+[1-9][0-9]{7,14}$'
$$;

-- Link tokens are never stored; only their SHA-256 digest in lowercase hex.
create function private.is_token_hash(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~ '^[0-9a-f]{64}$'
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Enums -----------------------------------------------------------------------

-- "Due soon", "expired" and "grace period" are derived from expires_on.
create type public.subscription_status as enum ('trial', 'active', 'suspended');

create type public.subscription_plan as enum ('basic', 'pro');

create type public.billing_period as enum ('monthly', 'quarterly', 'annual');

create type public.payment_method as enum (
  'bank_transfer',
  'nequi',
  'daviplata',
  'bre_b'
);

create type public.user_role as enum ('owner', 'super_admin');

create type public.appointment_status as enum (
  'confirmed',
  'attended',
  'no_show',
  'cancelled_by_customer',
  'cancelled_by_barbershop'
);

create type public.appointment_source as enum ('web', 'manual');

create type public.notification_type as enum (
  'appointment_confirmed',
  'appointment_reminder',
  'appointment_cancelled',
  'appointment_rescheduled',
  'barber_new_booking',
  'barber_booking_cancelled',
  'subscription_expiring',
  'subscription_expired',
  'subscription_suspended',
  'subscription_payment_registered'
);

create type public.notification_channel as enum ('whatsapp', 'email');

create type public.notification_status as enum (
  'pending',
  'sent',
  'failed',
  'cancelled'
);
