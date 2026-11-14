-- Task "Mis citas" (P2, C-19 to C-21): the email with the customer's link to
-- their upcoming appointments in a barbershop. A new value of the enum goes
-- in its own migration, so the next one can use it.
alter type public.notification_type add value if not exists 'customer_appointments';
