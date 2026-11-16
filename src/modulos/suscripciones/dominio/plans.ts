// The plans an establishment chooses (task 7.8), as the catalog `plans` keeps
// them: plan 1 (standard) and plan 2 (plus) are chosen at sign-up; "por
// acuerdo" is agreed with Yapoin by WhatsApp. The database decides; this is
// what the screens need to say it.

export const SIGNUP_PLANS = ["standard", "plus"] as const;

export type SignupPlan = (typeof SIGNUP_PLANS)[number];

// The plan in a link (yapoin.com/registro?plan=2): the number people see.
const PLAN_PARAMS = { "1": "standard", "2": "plus" } as const satisfies Record<
  string,
  SignupPlan
>;

export type PlanParam = keyof typeof PLAN_PARAMS;

export function planFromParam(value: unknown): SignupPlan {
  return typeof value === "string" && Object.hasOwn(PLAN_PARAMS, value)
    ? PLAN_PARAMS[value as PlanParam]
    : "standard";
}

export function paramOf(plan: SignupPlan): PlanParam {
  return plan === "plus" ? "2" : "1";
}

// Only plan 1 has the free trial.
export function hasTrial(plan: string): boolean {
  return plan === "standard";
}
