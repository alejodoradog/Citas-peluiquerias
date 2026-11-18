import { describe, expect, it } from "vitest";
import {
  addDays,
  fromBogota,
  startOfBogotaDay,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import type { AgendaBlock } from "./owner-agenda";
import { ownerClosedBlockDays, parseBlockTarget } from "./owner-block";

const ID = "aaaaaaaa-0000-4000-8000-000000000001";

describe("parseBlockTarget", () => {
  it("takes the owner's own agenda and the whole establishment without an id", () => {
    expect(parseBlockTarget("mine", "")).toEqual({ kind: "mine" });
    // The id of "Mi agenda" never comes from the browser.
    expect(parseBlockTarget("mine", ID)).toEqual({ kind: "mine" });
    expect(parseBlockTarget("shop", ID)).toEqual({ kind: "shop" });
  });

  it("takes another professional only with an id", () => {
    expect(parseBlockTarget("barber", ID)).toEqual({
      kind: "barber",
      barberId: ID,
    });
    expect(parseBlockTarget("barber", "")).toBeNull();
    expect(parseBlockTarget("barber", "1; drop table")).toBeNull();
  });

  it("refuses anything else", () => {
    expect(parseBlockTarget("", "")).toBeNull();
    expect(parseBlockTarget("todos", ID)).toBeNull();
  });
});

// 2027-03-01 is a Monday and no holiday; 2027-03-22 (San José, moved) is.
const MONDAY = "2027-03-01" as BogotaDate;
const HOLIDAY = "2027-03-22" as BogotaDate;
const everyDay = (start: string, end: string): WeeklyShift[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start, end }));
const closure = (
  date: BogotaDate,
  start: string,
  end: string,
  barberId: string | null = null,
): AgendaBlock => ({
  id: `${date}-${start}-${barberId ?? "todos"}`,
  barberId,
  start: fromBogota(date, start),
  end: fromBogota(date, end),
  reason: null,
});

describe("ownerClosedBlockDays", () => {
  const shopHours = everyDay("06:00", "22:00").filter((s) => s.weekday !== 2);
  // Monday to Thursday, and the holiday; the establishment closes Tuesdays.
  const days = [
    MONDAY,
    addDays(MONDAY, 1),
    addDays(MONDAY, 2),
    addDays(MONDAY, 3),
    HOLIDAY,
  ];
  const morning = {
    usesBarbershopHours: false,
    // Not on Thursdays.
    shifts: everyDay("08:00", "12:00").filter((s) => s.weekday !== 4),
  };

  it("closes, for a professional, the days they do not work and the holidays not opened", () => {
    expect(
      ownerClosedBlockDays(
        { shopHours, holidayOpenings: [], blocks: [] },
        morning,
        days,
      ),
    ).toEqual([addDays(MONDAY, 1), addDays(MONDAY, 3), HOLIDAY]);
  });

  it("closes the days the establishment closed for all their hours, never for their own blocks", () => {
    const blocks = [
      closure(addDays(MONDAY, 2), "07:00", "12:30"),
      // A block of a professional closes nothing for anyone else.
      closure(addDays(MONDAY, 4), "00:00", "23:45", ID),
    ];
    expect(
      ownerClosedBlockDays(
        { shopHours, holidayOpenings: [HOLIDAY], blocks },
        morning,
        [addDays(MONDAY, 2), addDays(MONDAY, 4), HOLIDAY],
      ),
    ).toEqual([addDays(MONDAY, 2)]);
  });

  it("keeps a day open while some of their hours are", () => {
    expect(
      ownerClosedBlockDays(
        {
          shopHours,
          holidayOpenings: [],
          blocks: [closure(addDays(MONDAY, 2), "08:00", "11:45")],
        },
        morning,
        [addDays(MONDAY, 2)],
      ),
    ).toEqual([]);
  });

  it("closes, for the whole establishment, the days it does not open or closed entirely", () => {
    const wholeDay: AgendaBlock = {
      id: "todo",
      barberId: null,
      start: startOfBogotaDay(addDays(MONDAY, 3)),
      end: startOfBogotaDay(addDays(MONDAY, 4)),
      reason: "Inventario",
    };
    expect(
      ownerClosedBlockDays(
        { shopHours, holidayOpenings: [], blocks: [wholeDay] },
        null,
        [MONDAY, addDays(MONDAY, 1), addDays(MONDAY, 3), HOLIDAY],
      ),
    ).toEqual([addDays(MONDAY, 1), addDays(MONDAY, 3), HOLIDAY]);
  });

  it("uses the establishment's hours, not its professionals' shifts", () => {
    // Thursday: the morning professional does not work, the establishment opens.
    expect(
      ownerClosedBlockDays(
        { shopHours, holidayOpenings: [], blocks: [] },
        null,
        [addDays(MONDAY, 3)],
      ),
    ).toEqual([]);
  });
});
