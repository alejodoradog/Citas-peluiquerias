import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IDLE } from "@/lib/formularios/form-state";
import { formatCalendarDay } from "@/lib/fechas/fechas";
import { textos } from "@/ui/textos";
import type { DayTimes } from "../../[slug]/reservar/slot-days";
import { capitalize } from "../../[slug]/reservar/when";

vi.mock("@/modulos/agenda/acciones/manage", () => ({
  rescheduleAppointment: async () => IDLE,
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const { RescheduleChooser } = await import("./reschedule-chooser");
const g = textos.reservas.gestionar;

// The appointment is on Saturday at 10:00.
const TODAY = "2026-11-20";
const none = { morning: [], afternoon: [], evening: [] };
const DAYS: DayTimes[] = [
  { date: TODAY, times: { morning: [], afternoon: ["15:00"], evening: [] } },
  {
    date: "2026-11-21",
    times: { morning: ["09:00", "10:00", "11:00"], afternoon: [], evening: [] },
  },
  { date: "2026-11-22", times: none },
];
const field = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name=${name}]`)!.value;

function renderChooser(
  props: Partial<React.ComponentProps<typeof RescheduleChooser>> = {},
) {
  return render(
    <RescheduleChooser
      token="tok"
      backHref="/c/tok"
      days={DAYS}
      today={TODAY}
      date={null}
      time={null}
      taken={null}
      current={{ date: "2026-11-21", time: "10:00" }}
      summary="Corte · 30 min · Ana"
      barberName="Ana"
      priceCop={25_000}
      {...props}
    />,
  );
}

describe("RescheduleChooser", () => {
  it("opens on the appointment's day without offering its own time", () => {
    renderChooser();
    expect(
      screen.getByRole("button", {
        name: capitalize(formatCalendarDay("2026-11-21")),
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("button", { name: "10:00 a. m." }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: g.reprogramar.boton }),
    ).toBeDisabled();
  });

  it("sends the chosen day and hour, chosen without leaving the screen", async () => {
    renderChooser();
    await userEvent.click(screen.getByRole("button", { name: "11:00 a. m." }));
    expect(screen.getByRole("button", { name: "11:00 a. m." })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(field("dia")).toBe("2026-11-21");
    expect(field("hora")).toBe("11:00");
    expect(
      screen.getByRole("button", { name: g.reprogramar.boton }),
    ).toBeEnabled();

    await userEvent.click(
      screen.getByRole("button", {
        name: capitalize(formatCalendarDay(TODAY)),
      }),
    );
    expect(field("dia")).toBe(TODAY);
    expect(field("hora")).toBe("");
    expect(screen.getByRole("button", { name: "3:00 p. m." })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("opens with the day and the hour the URL carries", () => {
    renderChooser({ date: "2026-11-21", time: "09:00" });
    expect(screen.getByRole("button", { name: "9:00 a. m." })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(field("hora")).toBe("09:00");
  });

  it("says so when the barber has nothing free in the window", () => {
    renderChooser({
      days: [
        { date: TODAY, times: none },
        { date: "2026-11-21", times: none },
      ],
    });
    expect(
      screen.getByText(g.reprogramar.sinHorasMes("Ana")),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: textos.reservas.hora.dias }),
    ).not.toBeInTheDocument();
  });
});
