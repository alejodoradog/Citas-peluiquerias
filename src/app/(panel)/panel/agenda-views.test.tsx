import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fromBogota } from "@/lib/fechas/fechas";
import {
  barberDay,
  gridHours,
  weekOf,
  weekSummary,
  type AgendaAppointment,
  type AgendaBarber,
} from "@/modulos/agenda/dominio/owner-agenda";
import { textos } from "@/ui/textos";
import { BarberDayList } from "./barber-day-list";
import { DayGrid } from "./day-grid";
import { WeekDays } from "./week-days";

const t = textos.agenda;
const DAY = "2026-11-07";
const MARIO = "11111111-1111-4111-8111-111111111111";
const at = (time: string) => fromBogota(DAY, time);
const early = at("06:00");
// The views get the server action from the page; the tests never submit.
const removeBlock = async () => ({ status: "done" as const });

const mario: AgendaBarber = {
  id: MARIO,
  name: "Mario",
  sortOrder: 1,
  active: true,
  usesBarbershopHours: true,
  shifts: [],
};

const shopHours = [{ weekday: 6, start: "09:00", end: "12:00" }];

const appointment = (
  fields: Partial<AgendaAppointment> = {},
): AgendaAppointment => ({
  id: "cita-1",
  barberId: MARIO,
  start: at("10:00"),
  end: at("11:00"),
  status: "confirmed",
  source: "manual",
  createdAt: at("06:00"),
  customerName: "Juan Pérez",
  serviceNames: ["Corte", "Barba"],
  ...fields,
});

function day(appointments: AgendaAppointment[] = [appointment()]) {
  return barberDay(
    DAY,
    mario,
    {
      shopHours,
      holidayOpenings: [],
      appointments,
      blocks: [
        {
          id: "b1",
          barberId: MARIO,
          start: at("11:00"),
          end: at("11:30"),
          reason: null,
        },
      ],
    },
    early,
  );
}

describe("DayGrid", () => {
  it("draws each appointment to scale and links it and the free spaces", () => {
    const days = [day()];
    render(
      <DayGrid
        date={DAY}
        days={days}
        hours={gridHours(DAY, days)!}
        now={early}
        barberHref={(id) => `/panel?barbero=${id}`}
        removeBlock={removeBlock}
      />,
    );
    const grid = screen.getByRole("region", { name: t.columnas });
    const card = within(grid).getByRole("link", {
      name: /^Juan P\..*Corte \+ Barba · manual.*10:00 a\. m\., Manual$/,
    });
    expect(card).toHaveAttribute("href", "/panel/citas/cita-1");
    // 9:00 is the top: 10:00 is one hour (56 px) down, and it lasts 56 - 2.
    expect(card).toHaveStyle({ top: "56px", height: "54px" });
    expect(within(card).getByText("Corte + Barba · manual")).toBeVisible();
    expect(within(grid).getByText(t.bloqueo)).toBeInTheDocument();
    expect(
      within(grid).getByRole("link", {
        name: t.libreDesde("9:00 a. m.", "Mario"),
      }),
    ).toHaveAttribute(
      "href",
      `/panel/citas/nueva?barbero=${MARIO}&dia=${DAY}&hora=09:00`,
    );
    // 11:30 to 12:00 is free too, but only 30 minutes: one piece.
    expect(
      within(grid).getByRole("link", {
        name: t.libreDesde("11:30 a. m.", "Mario"),
      }),
    ).toBeInTheDocument();
    expect(within(grid).getByRole("link", { name: "Mario" })).toHaveAttribute(
      "href",
      `/panel?barbero=${MARIO}`,
    );
  });
});

describe("BarberDayList", () => {
  it("lists the appointments, the free spaces and the blocks in order", () => {
    render(
      <BarberDayList
        day={day([appointment({ source: "web", createdAt: at("05:00") })])}
        date={DAY}
        removeBlock={removeBlock}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      `9:00 a. m.${t.libre("10:00")}`,
      `10:00 a. m.Juan P.Corte + Barba · 60 min${t.estados.new}`,
      `11:00 a. m.${t.bloqueo} · 30 min`,
      `11:30 a. m.${t.libre("12:00")}`,
    ]);
  });
});

describe("WeekDays", () => {
  it("links each day and says it is closed when nobody works", () => {
    const summary = weekSummary(weekOf(DAY), [mario], {
      shopHours,
      holidayOpenings: [],
      appointments: [appointment()],
      blocks: [],
    });
    render(
      <WeekDays
        days={summary}
        today={DAY}
        dayHref={(date) => `/panel?dia=${date}`}
        byBarber
      />,
    );
    const saturday = screen.getByRole("link", { name: /^Sáb 7 · hoy/ });
    expect(saturday).toHaveAttribute("aria-current", "date");
    expect(saturday).toHaveTextContent(t.citas(1));
    expect(saturday).toHaveTextContent("Mario 1");
    expect(
      within(saturday).getByRole("img", { name: t.ocupacion(33) }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Lun 2/ })).toHaveTextContent(
      t.cerrado,
    );
  });
});
