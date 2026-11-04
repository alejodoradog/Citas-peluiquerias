// Turns Supabase Auth error codes into errors the app understands. Shared by
// every module that signs people up or in.
// Codes: node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts.

export type AccountError =
  | "invalid_credentials"
  | "email_taken"
  | "rate_limited"
  | "weak_password"
  | "same_password"
  | "link_expired"
  | "unknown";

const byCode: Record<string, AccountError> = {
  invalid_credentials: "invalid_credentials",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
  weak_password: "weak_password",
  same_password: "same_password",
  otp_expired: "link_expired",
  session_not_found: "link_expired",
};

export function toAccountError(error: { code?: string }): AccountError {
  return (error.code && byCode[error.code]) || "unknown";
}
