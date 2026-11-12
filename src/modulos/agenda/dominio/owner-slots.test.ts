import { describe, expect, it } from "vitest";
import { fromBogota } from "@/lib/fechas/fechas";
import type { AgendaBarber } from "./owner-agenda";
import {
  appointmentActions,
  appointmentsInBlock,
  currentQuarter,
  ownerSlotDays,
} from "./owner-slots";

// Tuesday 2026-11-10, 10:07 in Bogotá.
const now = fromBogota("2026-11-10", "10:07");

const barber: AgendaBarber = {
  id: "uno",
  name: "Uno",
  sortOrder: 1,
  active: true,
  usesBarbershopHours: true,
  shifts: [],
};

const shopHours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  start: "09:00",
  end: "12:00",
}));

function starts(days: ReturnType<typeof ownerSlotDays>, date: string) {
  return (days.find((day) => day.date === date)?.slots ?? []).map((slot) =>
    slot.start.toISOString(),
  );
}

const at = (date: string, time: string) => fromBogota(date, time).toISOString();

describe("currentQuarter", () => {
  it("goes back to the start of the quarter hour", () => {
    expect(currentQuarter(now).toISOString()).toBe(at("2026-11-10", "10:00"));
    expect(
      currentQuarter(fromBogota("2026-11-10", "10:15")).toISOString(),
    ).toBe(at("2026-11-10", "10:15"));
  });
});

describe("ownerSlotDays", () => {
  const base = {
    now,
    barber,
    durationMinutes: 30,
    shopHours,
    holidayOpenings: [],
    appointments: [],
    blocks: [],
  };

  it("starts at the current quarter hour, with no minimum notice", () => {
    const today = starts(ownerSlotDays(base), "2026-11-10");
    expect(today[0]).toBe(at("2026-11-10", "10:00"));
    expect(today.at(-1)).toBe(at("2026-11-10", "11:30"));
  });

  it("covers today to today + 30", () => {
    const days = ownerSlotDays(base);
    expect(days[0]!.date).toBe("2026-11-10");
    expect(days.at(-1)!.date).toBe("2026-12-10");
  });

  it("leaves out the barber's appointments and blocks, and closures", () => {
    const days = ownerSlotDays({
      ...base,
      appointments: [
        {
          id: "a1",
          barberId: "uno",
          start: fromBogota("2026-11-11", "09:00"),
          end: fromBogota("2026-11-11", "09:30"),
        },
        {
          id: "a2",
          barberId: "dos",
          start: fromBogota("2026-11-11", "10:00"),
          end: fromBogota("2026-11-11", "10:30"),
        },
      ],
      blocks: [
        {
          barberId: "uno",
          start: fromBogota("2026-11-11", "11:00"),
          end: fromBogota("2026-11-11", "12:00"),
        },
        {
          barberId: null,
          start: fromBogota("2026-11-12", "09:00"),
          end: fromBogota("2026-11-12", "12:00"),
        },
      ],
    });
    expect(starts(days, "2026-11-11")).toEqual([
      at("2026-11-11", "09:30"),
      at("2026-11-11", "09:45"),
      at("2026-11-11", "10:00"),
      at("2026-11-11", "10:15"),
      at("2026-11-11", "10:30"),
    ]);
    expect(starts(days, "2026-11-12")).toEqual([]);
  });

  it("lets the appointment that moves take its own time", () => {
    const appointments = [
      {
        id: "a1",
        barberId: "uno",
        start: fromBogota("2026-11-11", "09:00"),
        end: fromBogota("2026-11-11", "09:30"),
      },
    ];
    const moving = ownerSlotDays({
      ...base,
      appointments,
      exceptAppointmentId: "a1",
    });
    expect(starts(moving, "2026-11-11")[0]).toBe(at("2026-11-11", "09:00"));
  });

  it("gives nothing for an inactive barber", () => {
    expect(
      ownerSlotDays({ ...base, barber: { ...barber, active: false } }),
    ).toEqual([]);
  });

  it("closes a holiday the barbershop does not open", () => {
    // 2026-11-16 is a Colombian holiday (Independencia de Cartagena).
    expect(starts(ownerSlotDays(base), "2026-11-16")).toEqual([]);
    expect(
      starts(
        ownerSlotDays({ ...base, holidayOpenings: ["2026-11-16"] }),
        "2026-11-16",
      ),
    ).toHaveLength(11);
  });
});

describe("appointmentActions", () => {
  const later = fromBogota("2026-11-10", "15:00");
  const earlier = fromBogota("2026-11-10", "09:00");

  it("marks only once the appointment started", () => {
    expect(
      appointmentActions({ status: "confirmed", start: later }, now).mark,
    ).toBe(false);
    expect(
      appointmentActions({ status: "confirmed", start: earlier }, now).mark,
    ).toBe(true);
  });

  it("corrects a mark", () => {
    expect(
      appointmentActions({ status: "no_show", start: earlier }, now),
    ).toEqual({
      mark: true,
      cancel: false,
      reschedule: false,
      editServices: false,
    });
  });

  it("cancels and moves only a confirmed appointment", () => {
    expect(
      appointmentActions({ status: "confirmed", start: later }, now),
    ).toEqual({
      mark: false,
      cancel: true,
      reschedule: true,
      editServices: true,
    });
    expect(
      appointmentActions({ status: "attended", start: earlier }, now),
    ).toEqual({
      mark: true,
      cancel: false,
      reschedule: false,
      editServices: true,
    });
  });

  it("does nothing with a cancelled appointment", () => {
    for (const status of [
      "cancelled_by_customer",
      "cancelled_by_barbershop",
    ] as const) {
      expect(appointmentActions({ status, start: earlier }, now)).toEqual({
        mark: false,
        cancel: false,
        reschedule: false,
        editServices: false,
      });
    }
  });
});

describe("appointmentsInBlock", () => {
  const appointments = [
    {
      barberId: "uno",
      start: fromBogota("2026-11-11", "12:00"),
      end: fromBogota("2026-11-11", "12:30"),
    },
    {
      barberId: "dos",
      start: fromBogota("2026-11-11", "13:00"),
      end: fromBogota("2026-11-11", "13:30"),
    },
  ];
  const block = {
    start: fromBogota("2026-11-11", "12:30"),
    end: fromBogota("2026-11-11", "14:00"),
  };

  it("finds the barber's appointments inside the block, edges excluded", () => {
    expect(appointmentsInBlock(appointments, "uno", block)).toEqual([]);
    expect(appointmentsInBlock(appointments, "dos", block)).toEqual([
      appointments[1],
    ]);
  });

  it("finds anyone's for the whole barbershop", () => {
    expect(
      appointmentsInBlock(appointments, null, {
        start: fromBogota("2026-11-11", "12:00"),
        end: fromBogota("2026-11-11", "14:00"),
      }),
    ).toEqual(appointments);
  });
});
