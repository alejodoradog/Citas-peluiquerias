// Why a function of the platform panel refused (migration
// add_subscription_payment_flow), as the screens of task 5.4 react to it:
// - not_allowed: the account is not a super admin (insufficient_privilege);
// - payment_required: Reactivar on a barbershop whose validity ran out
//   (hint subscription_payment_required): register a payment instead;
// - not_found: the payment was already voided, the barbershop is not
//   suspended, or its trial cannot be extended any more (no_data_found);
// - invalid: a value the database refused (an unknown plan, an empty reason);
// - unknown: anything else (the network).

export type PlatformRefusal =
  "not_allowed" | "payment_required" | "not_found" | "invalid" | "unknown";

export function toPlatformRefusal(error: {
  code?: string;
  hint?: string | null;
}): PlatformRefusal {
  if (error.hint === "subscription_payment_required") return "payment_required";
  switch (error.code) {
    case "42501":
      return "not_allowed";
    case "P0002":
      return "not_found";
    case "22023":
    case "23514":
      return "invalid";
    default:
      return "unknown";
  }
}
