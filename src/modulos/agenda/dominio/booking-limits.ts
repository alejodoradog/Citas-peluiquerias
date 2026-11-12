// The limits on public bookings (task 3.5, founder 2026-11-12). The database
// enforces them (migration add_booking_limits): private.max_bookings_per_ip_hour
// and private.max_upcoming_web_per_customer return the same numbers, and
// supabase/tests/database/31_booking_limits checks them.

// Bookings per hour from one IP in one barbershop.
export const MAX_BOOKINGS_PER_IP_HOUR = 10;

// Upcoming web appointments one email can hold in one barbershop.
export const MAX_UPCOMING_WEB_PER_CUSTOMER = 5;
