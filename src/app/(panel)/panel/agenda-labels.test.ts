import { describe, expect, it } from "vitest";
import { fromBogota } from "@/lib/fechas/fechas";
import { weekOf } from "@/modulos/agenda/dominio/owner-agenda";
import {
  dayTitle,
  hourLabel,
  timeLabel,
  weekDayLabel,
  weekTitle,
} from "./agenda-labels";

describe("agenda labels", () => {
  it("writes the day as D-30 does", () => {
    expect(dayTitle("2026-11-07", "2026-11-07")).toBe("Hoy, sábado 7 de nov");
    expect(dayTitle("2026-11-08", "2026-11-07")).toBe("Domingo 8 de nov");
    expect(dayTitle("2026-09-16", "2026-11-07")).toBe("Miércoles 16 de sept");
  });

  it("writes the week as D-32 does", () => {
    expect(weekTitle(weekOf("2026-11-07"))).toBe("2 – 8 de noviembre");
    expect(weekTitle(weekOf("2026-12-01"))).toBe(
      "30 de noviembre – 6 de diciembre",
    );
    expect(weekTitle(weekOf("2026-12-31"))).toBe(
      "28 de diciembre – 3 de enero",
    );
  });

  it("names each day of the week, and today", () => {
    expect(weekDayLabel("2026-11-02", "2026-11-07")).toBe("Lun 2");
    expect(weekDayLabel("2026-11-07", "2026-11-07")).toBe("Sáb 7 · hoy");
  });

  it("writes times in Bogotá", () => {
    expect(timeLabel(fromBogota("2026-11-07", "09:20"))).toBe("9:20 a. m.");
    expect(timeLabel(fromBogota("2026-11-07", "17:00"))).toBe("5:00 p. m.");
    expect(hourLabel(fromBogota("2026-11-07", "13:00"))).toBe("1:00");
    expect(hourLabel(fromBogota("2026-11-07", "09:00"))).toBe("9:00");
  });
});
