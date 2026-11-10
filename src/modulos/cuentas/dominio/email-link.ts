// How long the links in the account emails last in Supabase Auth (otp_expiry
// in supabase/config.toml, and the same value in each cloud project). Decided
// by the founder on 2026-11-09, as the D-03 design reads. The app accepts a
// recovery link only within its first hour (recovery-session.ts).
export const EMAIL_LINK_HOURS = 24;
