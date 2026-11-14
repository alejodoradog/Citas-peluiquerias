import { addDays, type BogotaDate } from "@/lib/fechas/fechas";

// The subscription of a barbershop (spec, "Suscripciones y activación
// manual" and "Regla de fechas"; decision 0006, migration 9). The database
// is the source of truth: private.recompute_subscription and
// private.barbershop_phase. These are the same rules for the screens (task
// 5.4, and the notices of task 5.5); subscription.test.ts runs the database's
// own test cases against them.

export type SubscriptionStatus = "trial" | "active" | "suspended";
export type Phase =
  "active" | "awaiting_first_payment" | "expired" | "suspended";

// Days of grace after expires_on during which the barbershop still works.
export const GRACE_DAYS = 5;
// "Por vencer" (decision P6): the first notice of the spec, 3 days before.
export const EXPIRING_DAYS = 3;

// A date plus one month as Postgres does it (date + interval '1 month'): the
// same day of the next month, or its last day ("2026-01-31" → "2026-02-28").
export function addMonth(date: BogotaDate): BogotaDate {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${nextYear}-${pad(nextMonth)}-${pad(Math.min(day, lastDay))}`;
}

// One payment over the current expiry: paid on or before it, the month is
// added to it; paid later, it counts from the payment day.
function coverage(expiry: BogotaDate, paidOn: BogotaDate) {
  return paidOn <= expiry
    ? { from: addDays(expiry, 1), until: addMonth(expiry) }
    : { from: paidOn, until: addDays(addMonth(paidOn), -1) };
}

// private.recompute_subscription: the non-voided payments, in the order of
// their payment day (then as registered), over the end of the trial.
export function replayPayments(
  trialEndsOn: BogotaDate,
  payments: readonly { id: string; paidOn: BogotaDate }[],
): {
  expiresOn: BogotaDate;
  coverages: { id: string; from: BogotaDate; until: BogotaDate }[];
} {
  let expiry = trialEndsOn;
  const coverages = [...payments]
    .map((payment, index) => ({ payment, index }))
    .sort(
      (a, b) =>
        a.payment.paidOn.localeCompare(b.payment.paidOn) || a.index - b.index,
    )
    .map(({ payment }) => {
      const period = coverage(expiry, payment.paidOn);
      expiry = period.until;
      return { id: payment.id, ...period };
    });
  return { expiresOn: expiry, coverages };
}

// P-03, "Queda activa hasta": the expiry a new payment on paidOn leaves,
// replayed with the payments the barbershop already has (not voided, in the
// order they were registered), as the database will do. late: it counts
// from the payment day; otherwise the month is added to expiredBefore.
export function paymentPreview(
  trialEndsOn: BogotaDate,
  payments: readonly { id: string; paidOn: BogotaDate }[],
  paidOn: BogotaDate,
): { until: BogotaDate; late: boolean; expiredBefore: BogotaDate | null } {
  const NEW = "\u0000new";
  const replay = replayPayments(trialEndsOn, [
    ...payments,
    { id: NEW, paidOn },
  ]);
  const own = replay.coverages.find((item) => item.id === NEW)!;
  const late = own.from === paidOn;
  return {
    until: replay.expiresOn,
    late,
    expiredBefore: late ? null : addDays(own.from, -1),
  };
}

// private.barbershop_phase.
export function phaseOf(
  shop: {
    status: SubscriptionStatus;
    plan: string | null;
    trialEndsOn: BogotaDate;
    expiresOn: BogotaDate;
    createdOn: BogotaDate;
  },
  today: BogotaDate,
): Phase {
  if (shop.status === "suspended") return "suspended";
  if (shop.plan === null && shop.trialEndsOn < shop.createdOn) {
    return "awaiting_first_payment";
  }
  return today <= addDays(shop.expiresOn, GRACE_DAYS) ? "active" : "expired";
}

// P-01 -------------------------------------------------------------------------------------------

export type PlatformBarbershop = {
  id: string;
  name: string;
  phase: Phase;
  subscriptionStatus: SubscriptionStatus;
  expiresOn: BogotaDate;
};

// The chip of each barbershop in P-01.
export type PlatformState =
  | "trial"
  | "active"
  | "expiring"
  | "grace"
  | "expired"
  | "suspended"
  | "awaiting";

export function platformState(
  shop: Pick<PlatformBarbershop, "phase" | "subscriptionStatus" | "expiresOn">,
  today: BogotaDate,
): PlatformState {
  if (shop.phase === "suspended") return "suspended";
  if (shop.phase === "awaiting_first_payment") return "awaiting";
  if (shop.phase === "expired") return "expired";
  if (today > shop.expiresOn) return "grace";
  if (shop.expiresOn <= addDays(today, EXPIRING_DAYS)) return "expiring";
  return shop.subscriptionStatus === "trial" ? "trial" : "active";
}

// The filters of P-01, in order. "Vencidas" holds those in grace, those
// expired and those awaiting their first payment (decision P7).
export const PLATFORM_FILTERS = [
  "todas",
  "prueba",
  "activas",
  "porVencer",
  "vencidas",
  "suspendidas",
] as const;
export type PlatformFilter = (typeof PLATFORM_FILTERS)[number];

export function filterOf(
  state: PlatformState,
): Exclude<PlatformFilter, "todas"> {
  switch (state) {
    case "trial":
      return "prueba";
    case "active":
      return "activas";
    case "expiring":
      return "porVencer";
    case "suspended":
      return "suspendidas";
    default:
      return "vencidas";
  }
}

export function platformCounts(
  shops: readonly PlatformBarbershop[],
  today: BogotaDate,
): Record<PlatformFilter, number> {
  const counts = Object.fromEntries(
    PLATFORM_FILTERS.map((filter) => [filter, 0]),
  ) as Record<PlatformFilter, number>;
  for (const shop of shops) {
    counts.todas += 1;
    counts[filterOf(platformState(shop, today))] += 1;
  }
  return counts;
}

// P-06 -------------------------------------------------------------------------------------------

// The four cards of P-06 (decision P11): a barbershop about to expire counts
// as active or in trial by its own status, since P-06 has no "por vencer".
export function metricCounts(
  shops: readonly PlatformBarbershop[],
  today: BogotaDate,
): { activas: number; prueba: number; vencidas: number; suspendidas: number } {
  const counts = { activas: 0, prueba: 0, vencidas: 0, suspendidas: 0 };
  for (const shop of shops) {
    const state = platformState(shop, today);
    if (state === "expiring") {
      counts[shop.subscriptionStatus === "trial" ? "prueba" : "activas"] += 1;
    } else {
      const filter = filterOf(state);
      if (filter !== "porVencer") counts[filter] += 1;
    }
  }
  return counts;
}

// "Ingreso del mes" and "Mes anterior" (decision P9): the payments that are
// not voided, by the Bogotá month of their payment day.
export function revenue(
  payments: readonly {
    amountCop: number;
    paidOn: BogotaDate;
    voided: boolean;
  }[],
  today: BogotaDate,
): {
  month: { totalCop: number; count: number };
  previous: { totalCop: number; count: number };
} {
  const month = today.slice(0, 7);
  const previous = addDays(`${month}-01`, -1).slice(0, 7);
  const sum = (key: string) => {
    const paid = payments.filter(
      (payment) => !payment.voided && payment.paidOn.slice(0, 7) === key,
    );
    return {
      totalCop: paid.reduce((total, payment) => total + payment.amountCop, 0),
      count: paid.length,
    };
  };
  return { month: sum(month), previous: sum(previous) };
}
