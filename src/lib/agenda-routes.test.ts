import { describe, expect, it } from "vitest";
import { agendaHref, newAppointmentHref, routes } from "./routes";

// Task 4.1: the links of the agenda carry what it shows in the query.
describe("agenda routes", () => {
  it("is the panel's home without a query", () => {
    expect(agendaHref()).toBe(routes.panel);
    expect(agendaHref({ vista: undefined })).toBe("/panel");
  });

  it("keeps the order and the colon of the times", () => {
    expect(
      agendaHref({ vista: "semana", dia: "2026-11-07", barbero: "abc" }),
    ).toBe("/panel?vista=semana&dia=2026-11-07&barbero=abc");
    expect(
      newAppointmentHref({ barbero: "abc", dia: "2026-11-07", hora: "10:30" }),
    ).toBe("/panel/citas/nueva?barbero=abc&dia=2026-11-07&hora=10:30");
    expect(newAppointmentHref()).toBe("/panel/citas/nueva");
  });

  it("encodes anything else", () => {
    expect(agendaHref({ barbero: "a&b c" })).toBe("/panel?barbero=a%26b%20c");
  });

  it("leads each card to its appointment", () => {
    expect(routes.panelAppointment("abc")).toBe("/panel/citas/abc");
  });
});
