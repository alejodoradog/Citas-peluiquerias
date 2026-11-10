import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleState } from "@/modulos/barberias/acciones/barber-schedule";
import {
  DEFAULT_BARBERSHOP_HOURS,
  type WeeklyShift,
} from "@/modulos/barberias/dominio/hours";
import { textos } from "@/ui/textos";
import { ScheduleEditor, type ScheduleBarber } from "./schedule-editor";

const t = textos.horario;

const kevin: ScheduleBarber = {
  id: "00000000-0000-0000-0000-000000000001",
  displayName: "Kevin",
  usesBarbershopHours: true,
  shifts: [],
};

const idle = async (): Promise<ScheduleState> => ({ status: "idle" });

const sentShifts = (): WeeklyShift[] =>
  JSON.parse(
    document.querySelector<HTMLInputElement>('input[name="shifts"]')!.value,
  );

const day = (name: string) => screen.getByRole("group", { name });

function renderEditor(
  barber: ScheduleBarber = kevin,
  action: (
    previous: ScheduleState,
    formData: FormData,
  ) => Promise<ScheduleState> = idle,
) {
  return render(
    <ScheduleEditor
      action={action}
      barber={barber}
      shopHours={DEFAULT_BARBERSHOP_HOURS}
    />,
  );
}

describe("ScheduleEditor", () => {
  it("starts on the barbershop's hours, with their summary", () => {
    renderEditor();
    expect(
      screen.getByRole("heading", { level: 1, name: t.titulo("Kevin") }),
    ).toBeInTheDocument();
    const usesShop = screen.getByRole("switch", { name: t.usaBarberia });
    expect(usesShop).toBeChecked();
    expect(usesShop).toHaveAccessibleDescription(
      "Lun a vie 9:00 a. m. – 8:00 p. m. · Sáb 8:00 a. m. – 9:00 p. m.",
    );
    expect(screen.queryByRole("group", { name: "Lunes" })).toBeNull();
    expect(sentShifts()).toEqual([]);
    expect(
      screen.getByRole("link", { name: textos.ui.volver }),
    ).toHaveAttribute("href", `/panel/barberos/${kevin.id}`);
    expect(screen.getByRole("button", { name: t.guardar })).toBeEnabled();
  });

  it("says when the barbershop has no hours yet", () => {
    render(<ScheduleEditor action={idle} barber={kevin} shopHours={[]} />);
    expect(
      screen.getByRole("switch", { name: t.usaBarberia }),
    ).toHaveAccessibleDescription(t.barberiaSinHorario);
  });

  it("copies the barbershop's hours when the switch goes off", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("switch", { name: t.usaBarberia }));

    expect(screen.getByText(t.bajada)).toBeInTheDocument();
    for (const name of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]) {
      const group = day(name);
      expect(
        within(group).getByRole("switch", { name: t.trabaja(name) }),
      ).toBeChecked();
      expect(
        within(group).getByRole("combobox", { name: t.desde }),
      ).toHaveValue("09:00");
      expect(
        within(group).getByRole("combobox", { name: t.hasta }),
      ).toHaveValue("20:00");
    }
    expect(
      within(day("Sábado")).getByRole("combobox", { name: t.hasta }),
    ).toHaveValue("21:00");
    const sunday = within(day("Domingo")).getByRole("switch", {
      name: t.trabaja("Domingo"),
    });
    expect(sunday).not.toBeChecked();
    expect(sunday).toHaveAccessibleDescription(t.descansa);
    expect(within(day("Domingo")).queryByRole("combobox")).toBeNull();
    expect(sentShifts()).toEqual(DEFAULT_BARBERSHOP_HOURS);

    // On again: nothing of their own is sent.
    await user.click(screen.getByRole("switch", { name: t.usaBarberia }));
    expect(screen.queryByRole("group", { name: "Lunes" })).toBeNull();
    expect(sentShifts()).toEqual([]);
  });

  it("offers every quarter hour, read as Colombians do", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("switch", { name: t.usaBarberia }));
    const from = within(day("Lunes")).getByRole("combobox", { name: t.desde });
    const options = within(from).getAllByRole("option");
    expect(options).toHaveLength(96);
    expect(options[0]).toHaveTextContent("12:00 a. m.");
    expect(options[0]).toHaveValue("00:00");
    expect(options.at(-1)).toHaveTextContent("11:45 p. m.");
  });

  it("edits a day: times, a split shift, removing it and a day off", async () => {
    const user = userEvent.setup();
    renderEditor({
      ...kevin,
      usesBarbershopHours: false,
      shifts: [
        { weekday: 1, start: "09:00", end: "20:00" },
        { weekday: 2, start: "09:00", end: "20:00" },
      ],
    });
    expect(
      screen.getByRole("switch", { name: t.usaBarberia }),
    ).not.toBeChecked();
    expect(
      within(day("Miércoles")).getByRole("switch", {
        name: t.trabaja("Miércoles"),
      }),
    ).not.toBeChecked();

    const monday = day("Lunes");
    await user.click(
      within(monday).getByRole("button", { name: t.partirDia("Lunes") }),
    );
    const first = within(monday).getByRole("group", { name: t.tramos[0] });
    const second = within(monday).getByRole("group", { name: t.tramos[1] });
    expect(within(first).getByRole("combobox", { name: t.hasta })).toHaveValue(
      "14:00",
    );
    expect(within(second).getByRole("combobox", { name: t.desde })).toHaveValue(
      "15:00",
    );
    // Two shifts are the most a day takes.
    expect(
      within(monday).queryByRole("button", { name: t.partirDia("Lunes") }),
    ).toBeNull();

    await user.selectOptions(
      within(first).getByRole("combobox", { name: t.hasta }),
      "12:00",
    );
    await user.selectOptions(
      within(second).getByRole("combobox", { name: t.desde }),
      "14:00",
    );
    await user.selectOptions(
      within(second).getByRole("combobox", { name: t.hasta }),
      "18:00",
    );
    expect(sentShifts()).toEqual([
      { weekday: 1, start: "09:00", end: "12:00" },
      { weekday: 1, start: "14:00", end: "18:00" },
      { weekday: 2, start: "09:00", end: "20:00" },
    ]);

    // Tuesday is split and put back.
    const tuesday = day("Martes");
    await user.click(
      within(tuesday).getByRole("button", { name: t.partirDia("Martes") }),
    );
    await user.click(
      within(tuesday).getByRole("button", { name: t.quitarDia("Martes") }),
    );
    expect(within(tuesday).getAllByRole("combobox")).toHaveLength(2);
    expect(
      within(tuesday).queryByRole("group", { name: t.tramos[1] }),
    ).toBeNull();

    // A day off keeps its shifts for when it works again.
    const mondaySwitch = within(monday).getByRole("switch", {
      name: t.trabaja("Lunes"),
    });
    await user.click(mondaySwitch);
    expect(within(monday).queryByRole("combobox")).toBeNull();
    expect(sentShifts().filter((s) => s.weekday === 1)).toEqual([]);
    await user.click(mondaySwitch);
    expect(within(monday).getAllByRole("combobox")).toHaveLength(4);

    // A day that starts working takes the barbershop's hours of that day.
    await user.click(
      within(day("Sábado")).getByRole("switch", { name: t.trabaja("Sábado") }),
    );
    expect(sentShifts().filter((s) => s.weekday === 6)).toEqual([
      { weekday: 6, start: "08:00", end: "21:00" },
    ]);
    // And one the barbershop does not open, a plain day to adjust.
    await user.click(
      within(day("Domingo")).getByRole("switch", {
        name: t.trabaja("Domingo"),
      }),
    );
    expect(sentShifts().filter((s) => s.weekday === 0)).toEqual([
      { weekday: 0, start: "09:00", end: "18:00" },
    ]);
  });

  it("sends the switch and the week, and shows each day's error with focus", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async (_: ScheduleState, formData: FormData): Promise<ScheduleState> => ({
        status: "invalid",
        fieldErrors: { day1: "hours_outside_shop", day3: "hours_order" },
        values: {
          usesBarbershopHours: String(
            formData.get("usesBarbershopHours") ?? "",
          ),
          shifts: String(formData.get("shifts")),
        },
      }),
    );
    renderEditor(
      {
        ...kevin,
        usesBarbershopHours: false,
        shifts: [
          { weekday: 1, start: "06:00", end: "08:00" },
          { weekday: 3, start: "12:00", end: "09:00" },
        ],
      },
      action,
    );
    await user.click(screen.getByRole("button", { name: t.guardar }));

    const formData = action.mock.calls[0]![1];
    expect(formData.get("barberId")).toBe(kevin.id);
    expect(formData.get("usesBarbershopHours")).toBeNull();
    expect(JSON.parse(String(formData.get("shifts")))).toEqual([
      { weekday: 1, start: "06:00", end: "08:00" },
      { weekday: 3, start: "12:00", end: "09:00" },
    ]);

    const mondayFrom = within(day("Lunes")).getByRole("combobox", {
      name: t.desde,
    });
    await waitFor(() => expect(mondayFrom).toHaveFocus());
    expect(mondayFrom).toHaveAttribute("aria-invalid", "true");
    expect(mondayFrom).toHaveAccessibleDescription(
      `${t.errores.hours_outside_shop} ${t.barberiaAbre("9:00 a. m. – 8:00 p. m.")}`,
    );
    expect(
      within(day("Miércoles")).getByRole("combobox", { name: t.hasta }),
    ).toHaveAccessibleDescription(t.errores.hours_order);
    expect(within(day("Martes")).queryByText(t.errores.hours_order)).toBeNull();
    // What the owner chose survives the form's reset after the action.
    expect(mondayFrom).toHaveValue("06:00");
    expect(
      screen.getByRole("switch", { name: t.usaBarberia }),
    ).not.toBeChecked();
    expect(sentShifts()).toEqual([
      { weekday: 1, start: "06:00", end: "08:00" },
      { weekday: 3, start: "12:00", end: "09:00" },
    ]);
  });

  it("says a closed day of the barbershop opens nothing", async () => {
    const user = userEvent.setup();
    renderEditor(
      {
        ...kevin,
        usesBarbershopHours: false,
        shifts: [{ weekday: 0, start: "10:00", end: "12:00" }],
      },
      async () => ({
        status: "invalid",
        fieldErrors: { day0: "hours_outside_shop" },
        values: {},
      }),
    );
    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(
      await within(day("Domingo")).findByText(
        `${t.errores.hours_outside_shop} ${t.barberiaCerrada}`,
      ),
    ).toBeInTheDocument();
  });

  it("sends the switch on, and shows what could not be saved", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ScheduleState> => ({
      status: "failed",
      error: "unknown",
      values: {},
    }));
    renderEditor({ ...kevin, usesBarbershopHours: false }, action);
    await user.click(screen.getByRole("switch", { name: t.usaBarberia }));
    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.unknown,
    );
    const formData = (
      action.mock.calls[0] as unknown as [ScheduleState, FormData]
    )[1];
    expect(formData.get("usesBarbershopHours")).toBe("on");
    expect(formData.get("shifts")).toBe("[]");
  });
});

// Next.js keeps a page it leaves mounted and hidden (Activity) and shows the
// same instance again on coming back.
describe("ScheduleEditor, hidden and shown again", () => {
  function inActivity(mode: "visible" | "hidden") {
    return (
      <Activity mode={mode}>
        <ScheduleEditor
          action={idle}
          barber={kevin}
          shopHours={DEFAULT_BARBERSHOP_HOURS}
        />
      </Activity>
    );
  }

  it("starts again from what is saved, not from the draft", async () => {
    const user = userEvent.setup();
    const { rerender } = render(inActivity("visible"));
    await user.click(screen.getByRole("switch", { name: t.usaBarberia }));
    expect(screen.getByRole("group", { name: "Lunes" })).toBeInTheDocument();

    rerender(inActivity("hidden"));
    rerender(inActivity("visible"));

    expect(screen.getByRole("switch", { name: t.usaBarberia })).toBeChecked();
    expect(screen.queryByRole("group", { name: "Lunes" })).toBeNull();
    expect(sentShifts()).toEqual([]);
  });
});
