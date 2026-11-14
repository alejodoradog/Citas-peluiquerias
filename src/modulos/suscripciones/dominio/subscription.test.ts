import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/fechas/fechas";
import {
  addMonth,
  EXPIRING_DAYS,
  filterOf,
  metricCounts,
  platformCounts,
  platformState,
  paymentPreview,
  phaseOf,
  replayPayments,
  revenue,
  type PlatformBarbershop,
} from "./subscription";

// The same rules in TypeScript and in the database: the cases the pgTAP test
// runs against private.recompute_subscription and private.barbershop_phase
// (supabase/tests/database/45_platform_payments.test.sql) are read from that
// file and must give the same answers here.
const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "tests",
    "database",
    "45_platform_payments.test.sql",
  ),
  "utf8",
);

function block(start: string, end: string): string {
  const from = sql.indexOf(start);
  const to = sql.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`No block ${start}`);
  return sql.slice(from, to);
}

const formulaCases = [
  ...block(
    "-- casos de la fórmula",
    "-- fin de los casos de la fórmula",
  ).matchAll(
    /\('([^']+)', '(\d{4}-\d{2}-\d{2})', '\{([^}]*)\}', '(\d{4}-\d{2}-\d{2})'\)/g,
  ),
].map(([, name, trial, paid, expires]) => ({
  name: name!,
  trial: trial!,
  paid: paid ? paid.split(",") : [],
  expires: expires!,
}));

const phaseCases = [
  ...block("-- casos de la fase", "-- fin de los casos de la fase").matchAll(
    /\('([^']+)', '(\w+)', (null|'\w+'), (-?\d+), (-?\d+), (-?\d+), '(\w+)'\)/g,
  ),
].map(([, name, status, plan, trial, expires, created, phase]) => ({
  name: name!,
  status: status as "trial" | "active" | "suspended",
  plan: plan === "null" ? null : plan!.slice(1, -1),
  trial: Number(trial),
  expires: Number(expires),
  created: Number(created),
  phase: phase!,
}));

describe("the date rule, as the database applies it", () => {
  it("reads every case of the pgTAP test", () => {
    expect(formulaCases).toHaveLength(8);
    expect(phaseCases).toHaveLength(6);
  });

  it.each(formulaCases)("$name", ({ trial, paid, expires }) => {
    const payments = paid.map((paidOn, index) => ({
      id: String(index),
      paidOn,
    }));
    expect(replayPayments(trial, payments).expiresOn).toBe(expires);
  });

  it.each(phaseCases)("$name", (c) => {
    const today = "2026-11-13";
    expect(
      phaseOf(
        {
          status: c.status,
          plan: c.plan,
          trialEndsOn: addDays(today, c.trial),
          expiresOn: addDays(today, c.expires),
          createdOn: addDays(today, c.created),
        },
        today,
      ),
    ).toBe(c.phase);
  });
});

describe("addMonth", () => {
  it("adds a month as Postgres does, at most the last day of the month", () => {
    expect(addMonth("2026-01-31")).toBe("2026-02-28");
    expect(addMonth("2028-01-31")).toBe("2028-02-29");
    expect(addMonth("2026-11-09")).toBe("2026-12-09");
    expect(addMonth("2026-12-15")).toBe("2027-01-15");
  });
});

describe("replayPayments", () => {
  it("gives each payment its period, in the order of the payment day", () => {
    const { coverages } = replayPayments("2026-11-09", [
      { id: "late", paidOn: "2026-11-20" },
      { id: "early", paidOn: "2026-11-05" },
    ]);
    expect(coverages).toEqual([
      { id: "early", from: "2026-11-10", until: "2026-12-09" },
      { id: "late", from: "2026-12-10", until: "2027-01-09" },
    ]);
  });
});

describe("paymentPreview (P-03)", () => {
  it("adds the month to the expiry when paid on time", () => {
    expect(paymentPreview("2026-11-09", [], "2026-11-07")).toEqual({
      until: "2026-12-09",
      late: false,
      expiredBefore: "2026-11-09",
    });
  });

  it("counts from the payment day when paid late", () => {
    expect(paymentPreview("2026-11-09", [], "2026-11-12")).toEqual({
      until: "2026-12-11",
      late: true,
      expiredBefore: null,
    });
  });

  it("replays the payments already registered, as the database does", () => {
    // The trial ended on 5 Nov; a late payment of 10 Nov covers to 9 Dec. A
    // payment dated 3 Nov goes first: 6 Nov to 5 Dec, and then the 10 Nov
    // one adds its month to 5 Jan.
    expect(
      paymentPreview(
        "2026-11-05",
        [{ id: "a", paidOn: "2026-11-10" }],
        "2026-11-03",
      ),
    ).toEqual({
      until: "2027-01-05",
      late: false,
      expiredBefore: "2026-11-05",
    });
  });
});

describe("metricCounts (P-06, decision P11)", () => {
  it("counts one about to expire by its own status", () => {
    const today = "2026-11-07";
    expect(
      metricCounts(
        [
          shop({ expiresOn: "2026-11-09" }),
          shop({ subscriptionStatus: "active", expiresOn: "2026-11-09" }),
          shop({ subscriptionStatus: "active", expiresOn: "2026-12-09" }),
          shop({ expiresOn: "2026-11-04" }),
          shop({ phase: "suspended" }),
        ],
        today,
      ),
    ).toEqual({ activas: 2, prueba: 1, vencidas: 1, suspendidas: 1 });
  });
});

function shop(extra: Partial<PlatformBarbershop> = {}): PlatformBarbershop {
  return {
    id: "1",
    name: "Barbería",
    phase: "active",
    subscriptionStatus: "trial",
    expiresOn: "2026-11-24",
    ...extra,
  };
}

describe("platformState (P-01, decisions P6 and P7)", () => {
  const today = "2026-11-07";

  it("names each barbershop as the chips of P-01", () => {
    expect(platformState(shop(), today)).toBe("trial");
    expect(
      platformState(
        shop({ subscriptionStatus: "active", expiresOn: "2026-12-02" }),
        today,
      ),
    ).toBe("active");
    expect(
      platformState(shop({ expiresOn: addDays(today, EXPIRING_DAYS) }), today),
    ).toBe("expiring");
    expect(platformState(shop({ expiresOn: "2026-11-04" }), today)).toBe(
      "grace",
    );
    expect(platformState(shop({ phase: "expired" }), today)).toBe("expired");
    expect(platformState(shop({ phase: "suspended" }), today)).toBe(
      "suspended",
    );
    expect(
      platformState(shop({ phase: "awaiting_first_payment" }), today),
    ).toBe("awaiting");
  });

  it("counts them by the filters of P-01", () => {
    const shops = [
      shop(),
      shop({ subscriptionStatus: "active", expiresOn: "2026-12-02" }),
      shop({ expiresOn: "2026-11-09" }),
      shop({ expiresOn: "2026-11-04" }),
      shop({ phase: "awaiting_first_payment" }),
      shop({ phase: "suspended" }),
    ];
    expect(platformCounts(shops, today)).toEqual({
      todas: 6,
      prueba: 1,
      activas: 1,
      porVencer: 1,
      vencidas: 2,
      suspendidas: 1,
    });
    expect(filterOf("grace")).toBe("vencidas");
    expect(filterOf("awaiting")).toBe("vencidas");
    expect(filterOf("expiring")).toBe("porVencer");
  });
});

describe("revenue (P-06, decision P9)", () => {
  it("sums the payments that are not voided, by the month they were paid", () => {
    const payments = [
      { amountCop: 25000, paidOn: "2026-11-02", voided: false },
      { amountCop: 25000, paidOn: "2026-11-05", voided: true },
      { amountCop: 25000, paidOn: "2026-10-31", voided: false },
      { amountCop: 25000, paidOn: "2026-10-01", voided: false },
      { amountCop: 25000, paidOn: "2026-09-30", voided: false },
    ];
    expect(revenue(payments, "2026-11-07")).toEqual({
      month: { totalCop: 25000, count: 1 },
      previous: { totalCop: 50000, count: 2 },
    });
  });

  it("handles January, whose previous month is last year's December", () => {
    expect(
      revenue(
        [{ amountCop: 25000, paidOn: "2026-12-31", voided: false }],
        "2027-01-03",
      ).previous,
    ).toEqual({ totalCop: 25000, count: 1 });
  });
});
