-- Task 5.5b (docs/tareas/5.5-ciclo-suscripcion.md): the emails of the
-- subscription cycle and the cleanup of accounts never confirmed.
--
-- Spec, "Ciclo de la suscripción":
-- - step 2: notices to the owner 3 days before the end, on the day and 3 days
--   after, with the payment details and the exact amount;
-- - step 6: the barbershop pauses after the 5 days of grace;
-- - "Mensajes del MVP": suscripción por vencer, vencida, suspendida, pago
--   registrado.
-- The emails themselves are task 5.2 (send-notifications/render.ts): they
-- read the barbershop when they are sent, and a dated notice whose
-- expires_on no longer matches (the owner paid) is cancelled as outdated.

-- 1. The dated notices, once a day ----------------------------------------------------
-- Each stage has a window of days, so a day the job does not run is caught
-- the next one, and a dedupe key per stage and per expires_on, so each goes
-- once. A payment moves expires_on and starts a new cycle of keys.
--   before:  expires_on - 3 .. expires_on - 1   subscription_expiring
--   due:     expires_on                          subscription_expiring
--   grace:   expires_on + 3 .. expires_on + 5   subscription_expired
--   paused:  expires_on + 6 .. expires_on + 8   subscription_suspended
-- Left out (provisional decisions S9 and S10):
-- - a barbershop suspended by hand (suspend_barbershop, task 5.4): its owner
--   already knows, and paying alone does not lift it (spec, step 7);
-- - a sede awaiting its first payment: its expires_on is the old trial's;
-- - deleted barbershops.

create function private.enqueue_subscription_notices(
  p_today date default private.today_bogota()
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shop record;
  notice public.notification_type;
  stage text;
  queued integer := 0;
begin
  for shop in
    -- The rule of private.barbershop_phase, on p_today: active until the
    -- last day of grace, then expired.
    select
      b.id,
      b.expires_on,
      case when p_today <= b.expires_on + 5 then 'active' else 'expired' end as phase
    from public.barbershops b
    where b.deleted_at is null
      and b.subscription_status <> 'suspended'
      -- awaiting_first_payment (private.barbershop_phase)
      and not (b.plan is null
               and b.trial_ends_on < (b.created_at at time zone 'America/Bogota')::date)
      and p_today between b.expires_on - 3 and b.expires_on + 8
  loop
    notice := null;
    if shop.phase = 'active' and p_today < shop.expires_on then
      notice := 'subscription_expiring';
      stage := 'before';
    elsif shop.phase = 'active' and p_today = shop.expires_on then
      notice := 'subscription_expiring';
      stage := 'due';
    elsif shop.phase = 'active' and p_today >= shop.expires_on + 3 then
      notice := 'subscription_expired';
      stage := 'grace';
    elsif shop.phase = 'expired' then
      notice := 'subscription_suspended';
      stage := 'paused';
    end if;

    if notice is not null and private.enqueue_notification(
      shop.id,
      notice,
      'subscription:' || stage || ':' || shop.expires_on::text,
      null,
      now(),
      jsonb_build_object('expires_on', shop.expires_on)
    ) is not null then
      queued := queued + 1;
    end if;
  end loop;
  return queued;
end;
$$;

revoke all on function private.enqueue_subscription_notices(date) from public;

-- Every day at 08:00 in Bogotá (13:00 UTC), when an owner reads email.
select cron.schedule(
  'subscription-notices',
  '0 13 * * *',
  $$select private.enqueue_subscription_notices()$$
);

-- 2. "Recibimos tu pago" -----------------------------------------------------------------
-- Every payment the super admin registers (register_subscription_payment,
-- task 5.4). The payload carries only the payment's id (rule Q5 of task
-- 5.1); the email reads the amount and the new date when it is sent, and a
-- payment voided before that is not announced (5.2, no_payment).

create function private.enqueue_payment_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_notification(
    new.barbershop_id,
    'subscription_payment_registered',
    'payment:' || new.id::text,
    null,
    now(),
    jsonb_build_object('payment_id', new.id)
  );
  return null;
end;
$$;

revoke all on function private.enqueue_payment_notice() from public;

create trigger enqueue_payment_notice
  after insert on public.subscription_payments
  for each row execute function private.enqueue_payment_notice();

-- 3. Accounts never confirmed (decision S1: 7 days) ------------------------------------
-- An owner who signed up and never confirmed their email leaves a barbershop
-- holding its slug. After p_age the account goes, with its barbershops, if
-- they are empty: no appointments, customers, payments nor other members.
-- An unconfirmed owner cannot sign in, so their barbershop holds only what
-- sign-up created; anything else that refers to it (a foreign key) keeps the
-- account, and the next one is tried. Accounts without a barbershop (made by
-- hand, such as super admins) are never touched.

create function private.purge_unconfirmed_accounts(
  p_age interval default interval '7 days'
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid;
  shops uuid[];
  purged integer := 0;
begin
  for account in
    select u.id
    from auth.users u
    where u.email_confirmed_at is null
      and u.created_at < now() - p_age
      and exists (select 1 from public.memberships m where m.user_id = u.id)
      and not exists (
        select 1 from public.profiles p where p.id = u.id and p.is_super_admin
      )
      and not exists (
        select 1
        from public.memberships m
        where m.user_id = u.id
          and (
            exists (select 1 from public.appointments a where a.barbershop_id = m.barbershop_id)
            or exists (select 1 from public.customers c where c.barbershop_id = m.barbershop_id)
            or exists (select 1 from public.subscription_payments s where s.barbershop_id = m.barbershop_id)
            or exists (
              select 1 from public.memberships o
              where o.barbershop_id = m.barbershop_id and o.user_id <> u.id
            )
          )
      )
  loop
    begin
      select array_agg(m.barbershop_id) into shops
      from public.memberships m
      where m.user_id = account;

      delete from public.memberships where user_id = account;
      delete from public.barbershops where id = any (shops);
      delete from auth.users where id = account;
      purged := purged + 1;
    exception when foreign_key_violation then
      -- Something else refers to it: the account stays as it was.
      null;
    end;
  end loop;
  return purged;
end;
$$;

revoke all on function private.purge_unconfirmed_accounts(interval) from public;

-- Every day at 03:45 in Bogotá (08:45 UTC), after the purge of the queue.
select cron.schedule(
  'purge-unconfirmed-accounts',
  '45 8 * * *',
  $$select private.purge_unconfirmed_accounts()$$
);
