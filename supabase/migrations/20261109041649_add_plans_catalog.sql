-- Plans become a catalog table instead of an enum, with a single plan for now
-- (founder): 25.000 COP per barbershop (location) per month, up to 5 barbers.
-- The 5 barbers are informative: registering more is never blocked; the price
-- above 5 is an open decision. With a monthly price only, billing periods go
-- away: each payment covers one month, and paying several months is several
-- payments.
-- See docs/decisiones/0006-esquema-base-de-datos-final.md.

create table public.plans (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,29}$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  monthly_price_cop integer not null check (monthly_price_cop > 0),
  -- Barbers the price includes. Informative: never enforced.
  included_barbers integer not null check (included_barbers > 0),
  -- Inactive plans are kept for history but cannot be sold.
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.plans
  for each row execute function private.set_updated_at();

alter table public.plans enable row level security;

insert into public.plans (code, name, monthly_price_cop, included_barbers, sort_order)
values ('standard', 'Plan único', 25000, 5, 1);

-- Dev data on the old enum values moves to the single plan.
alter table public.barbershops
  alter column plan type text using (case when plan is null then null else 'standard' end),
  add constraint barbershops_plan_fkey
    foreign key (plan) references public.plans (code) on delete restrict;

alter table public.subscription_payments
  alter column plan type text using 'standard',
  add constraint subscription_payments_plan_fkey
    foreign key (plan) references public.plans (code) on delete restrict,
  drop column billing_period;

drop type public.subscription_plan;
drop type public.billing_period;

create index barbershops_plan_idx on public.barbershops (plan) where plan is not null;
create index subscription_payments_plan_idx on public.subscription_payments (plan);

-- Prices are public information (landing page and "Mi suscripción").
grant select on public.plans to anon, authenticated;

create policy public_read on public.plans
  for select to anon
  using (active);
create policy authenticated_read on public.plans
  for select to authenticated
  using (true);
