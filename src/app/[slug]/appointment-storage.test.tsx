import { beforeEach, describe, expect, it } from "vitest";
import { appointmentStorage } from "./appointment-storage";

// What this phone keeps of its appointments (task 3.4), in jsdom's
// localStorage. The file is .tsx only to run in the jsdom project.
const NOW = Date.parse("2026-11-20T15:00:00.000Z");
const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

beforeEach(() => {
  window.localStorage.clear();
});

describe("appointmentStorage", () => {
  it("keeps the links of a barbershop, the soonest first", () => {
    appointmentStorage.remember(
      { token: "b", slug: "la-esquina", startsAt: at(48) },
      NOW,
    );
    appointmentStorage.remember(
      { token: "a", slug: "la-esquina", startsAt: at(24) },
      NOW,
    );
    appointmentStorage.remember(
      { token: "o", slug: "otra", startsAt: at(5) },
      NOW,
    );
    expect(
      appointmentStorage.upcoming("la-esquina", NOW).map((item) => item.token),
    ).toEqual(["a", "b"]);
  });

  it("drops appointments that started and keeps the new time of a moved one", () => {
    appointmentStorage.remember(
      { token: "a", slug: "la-esquina", startsAt: at(24) },
      NOW,
    );
    appointmentStorage.remember(
      { token: "a", slug: "la-esquina", startsAt: at(30) },
      NOW,
    );
    appointmentStorage.remember(
      { token: "p", slug: "la-esquina", startsAt: at(-1) },
      NOW,
    );
    expect(appointmentStorage.upcoming("la-esquina", NOW)).toEqual([
      { token: "a", slug: "la-esquina", startsAt: at(30) },
    ]);
  });

  it("hides a cancelled one but still knows its barbershop until it is forgotten", () => {
    appointmentStorage.remember(
      { token: "a", slug: "la-esquina", startsAt: at(24) },
      NOW,
    );
    appointmentStorage.cancel("a");
    expect(appointmentStorage.upcoming("la-esquina", NOW)).toEqual([]);
    expect(appointmentStorage.slugOf("a")).toBe("la-esquina");
    appointmentStorage.forget("a");
    expect(appointmentStorage.slugOf("a")).toBe(null);
  });

  it("ignores what is not one of its entries, and clear forgets everything", () => {
    window.localStorage.setItem(
      "yapoin:mis-citas",
      JSON.stringify([
        { token: 1 },
        "x",
        { token: "a", slug: "s", startsAt: "no" },
      ]),
    );
    expect(appointmentStorage.upcoming("s", NOW)).toEqual([]);
    appointmentStorage.remember(
      { token: "a", slug: "s", startsAt: at(2) },
      NOW,
    );
    appointmentStorage.clear();
    expect(window.localStorage.getItem("yapoin:mis-citas")).toBe(null);
  });

  it("keeps at most 10", () => {
    for (let i = 1; i <= 12; i++) {
      appointmentStorage.remember(
        { token: `t${i}`, slug: "s", startsAt: at(i) },
        NOW,
      );
    }
    expect(appointmentStorage.upcoming("s", NOW)).toHaveLength(10);
  });
});
