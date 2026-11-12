// Cloudflare Turnstile (task 3.5, decision 0007): the invisible check that a
// person, not a script, sends the booking, sign-up, sign-in and recovery
// forms. The site key is public (it goes in the page). CI and Vercel
// Preview use Cloudflare's test keys through NEXT_PUBLIC_TURNSTILE_SITE_KEY;
// production uses the widget "Yapoin" (www.yapoin.com, yapoin.com,
// citas-peluiquerias.vercel.app). The secret never reaches the browser:
// TURNSTILE_SECRET_KEY in Vercel, and the same one in Supabase Auth.
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAF9s1ghuLnsBHG-O";

// The form field the widget fills with its one-time token.
export const TURNSTILE_FIELD = "cf-turnstile-response";
