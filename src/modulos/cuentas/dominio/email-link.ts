// How long the links in the confirmation and recovery emails last. Supabase
// Auth enforces it (otp_expiry in supabase/config.toml, and the same value in
// each cloud project); the screens only say it. Decided by the founder on
// 2026-11-09, as the D-03 design reads.
export const EMAIL_LINK_HOURS = 24;
