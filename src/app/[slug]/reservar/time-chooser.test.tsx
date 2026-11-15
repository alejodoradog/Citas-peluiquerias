import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { formatCalendarDay } from "@/lib/fechas/fechas";
import { bookingQuery } from "@/modulos/agenda/dominio/booking-flow";
import { textos } from "@/ui/textos";
import type { DayTimes } from "./slot-days";
import { capitalize } from "./when";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const { TimeChooser, withDayAndTime } = await import("./time-chooser");
const t = textos.reservas;

// Today (Friday) has nothing left; Saturday has three times, Sunday is
// closed and Monday has one.
const TODAY = "2026-11-20";
const none = { morning: [], afternoon: [], evening: [] };
const DAYS: DayTimes[] = [
  { date: TODAY, times: none },
  {
    date: "2026-11-21",
    times: { morning: ["09:00", "10:00"], afternoon: ["14:30"], evening: [] },
  },
  { date: "2026-11-22", times: none },
  {
    date: "2026-11-23",
    times: { morning: ["11:00"], afternoon: [], evening: [] },
  },
];
const FLOW = "/la-esquina/reservar";
const BASE = FLOW + bookingQuery({ serviceIds: ["s1", "s2"], barber: "b1" });
const dayButton = (date: string) =>
  screen.getByRole("button", {
    name: capitalize(formatCalendarDay(date)),
  });
const hourButton = (name: string) => screen.getByRole("button", { name });

function renderChooser(
  props: Partial<React.ComponentProps<typeof TimeChooser>> = {},
) {
  return render(
    <TimeChooser
      shopName="Barbería La Esquina"
      backHref={FLOW + "?paso=barbero"}
      continueHref={BASE}
      otherBarberHref={FLOW + "?paso=barbero"}
      days={DAYS}
      today={TODAY}
      date={null}
      time={null}
      taken={null}
      intro="Corte · 30 min · Ana"
      namedBarber="Ana"
      priceCop={25_000}
      {...props}
    />,
  );
}

describe("TimeChooser", () => {
  it("writes the details address exactly as the server does", () => {
    expect(withDayAndTime(BASE, "2026-11-21", "10:00")).toBe(
      FLOW +
        bookingQuery({
          serviceIds: ["s1", "s2"],
          barber: "b1",
          date: "2026-11-21",
          time: "10:00",
        }),
    );
  });

  it("shows the hours of a chosen day at once, and Continuar carries the hour", async () => {
    renderChooser();
    await userEvent.click(dayButton("2026-11-21"));
    expect(dayButton("2026-11-21")).toHaveAttribute("aria-pressed", "true");
    // Today has nothing free: once another day is chosen, it is no choice.
    expect(
      screen.getByRole("img", {
        name: t.hora.cerrado(capitalize(formatCalendarDay(TODAY))),
      }),
    ).toBeInTheDocument();
    expect(dayButton("2026-11-23")).toHaveAttribute("aria-pressed", "false");
    expect(hourButton("2:30 p. m.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.continuar })).toBeDisabled();

    await userEvent.click(hourButton("10:00 a. m."));
    expect(hourButton("10:00 a. m.")).toHaveAttribute("aria-pressed", "true");
    expect(hourButton("9:00 a. m.")).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText("Sábado 21 de noviembre · 10:00 a. m."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.continuar })).toHaveAttribute(
      "href",
      withDayAndTime(BASE, "2026-11-21", "10:00"),
    );
  });

  it("forgets the hour when another day is chosen", async () => {
    renderChooser();
    await userEvent.click(dayButton("2026-11-21"));
    await userEvent.click(hourButton("10:00 a. m."));
    await userEvent.click(dayButton("2026-11-23"));
    expect(hourButton("11:00 a. m.")).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("link", { name: t.continuar }),
    ).not.toBeInTheDocument();
  });

  it("opens with the day and the hour the URL carries", () => {
    renderChooser({ date: "2026-11-23", time: "11:00" });
    expect(dayButton("2026-11-23")).toHaveAttribute("aria-pressed", "true");
    expect(hourButton("11:00 a. m.")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: t.continuar })).toHaveAttribute(
      "href",
      withDayAndTime(BASE, "2026-11-23", "11:00"),
    );
  });

  it("drops an hour from the URL that is no longer free", () => {
    renderChooser({ date: "2026-11-21", time: "11:00", taken: "11:00" });
    expect(screen.getByRole("status")).toHaveTextContent(t.hora.tomada.titulo);
    expect(dayButton("2026-11-21")).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("button", { name: "11:00 a. m." }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.continuar })).toBeDisabled();
  });

  it("says when a day has no hours and jumps to the next free one", async () => {
    renderChooser();
    expect(
      screen.getByText(
        t.hora.sinHoras("Ana", t.hoy.toLocaleLowerCase("es-CO")),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: t.hora.otroBarbero }),
    ).toHaveAttribute("href", FLOW + "?paso=barbero");
    // A closed day is not a choice.
    expect(
      screen.getByRole("img", {
        name: t.hora.cerrado(capitalize(formatCalendarDay("2026-11-22"))),
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: t.hora.ir(formatCalendarDay("2026-11-21")),
      }),
    );
    expect(dayButton("2026-11-21")).toHaveAttribute("aria-pressed", "true");
    expect(hourButton("9:00 a. m.")).toBeInTheDocument();
  });

  it("names nobody when any barber will do", () => {
    renderChooser({ namedBarber: null, days: [{ date: TODAY, times: none }] });
    const box = screen
      .getByText(t.hora.sinHorasNadie(t.hoy.toLocaleLowerCase("es-CO")))
      .closest("div")!;
    expect(within(box).getByText(t.hora.ninguna)).toBeInTheDocument();
    expect(
      within(box).queryByRole("button", { name: /^Ir al/ }),
    ).not.toBeInTheDocument();
  });
});
