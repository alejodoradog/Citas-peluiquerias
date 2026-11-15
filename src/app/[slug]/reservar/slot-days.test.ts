import { describe, expect, it } from "vitest";
import { fromBogota } from "@/lib/fechas/fechas";
import { toDayTimes } from "./slot-days";

const slot = (date: string, time: string) => ({
  start: fromBogota(date, time),
  end: fromBogota(date, time),
  barberIds: ["b1"],
});

describe("toDayTimes", () => {
  it("keeps every day and groups its free times by part of the day, in order", () => {
    expect(
      toDayTimes([
        {
          date: "2026-11-21",
          slots: [
            slot("2026-11-21", "09:00"),
            slot("2026-11-21", "11:45"),
            slot("2026-11-21", "12:00"),
            slot("2026-11-21", "17:45"),
            slot("2026-11-21", "18:00"),
          ],
        },
        { date: "2026-11-22", slots: [] },
      ]),
    ).toEqual([
      {
        date: "2026-11-21",
        times: {
          morning: ["09:00", "11:45"],
          afternoon: ["12:00", "17:45"],
          evening: ["18:00"],
        },
      },
      {
        date: "2026-11-22",
        times: { morning: [], afternoon: [], evening: [] },
      },
    ]);
  });

  it("sends only dates and wall times, nothing about who is busy", () => {
    const [day] = toDayTimes([
      { date: "2026-11-21", slots: [slot("2026-11-21", "09:00")] },
    ]);
    expect(JSON.stringify(day)).not.toContain("b1");
  });
});
