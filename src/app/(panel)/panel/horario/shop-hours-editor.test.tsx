import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { describe, expect, it } from "vitest";
import type { ShopHoursState } from "@/modulos/barberias/acciones/shop-hours";
import {
  DEFAULT_BARBERSHOP_HOURS,
  type WeeklyShift,
} from "@/modulos/barberias/dominio/hours";
import { textos } from "@/ui/textos";
import { ShopHoursEditor, type OutsideBarber } from "./shop-hours-editor";

const t = textos.horarioBarberia;
const h = textos.horario;

const idle = async (): Promise<ShopHoursState> => ({ status: "idle" });

const sentShifts = (): WeeklyShift[] =>
  JSON.parse(
    document.querySelector<HTMLInputElement>('input[name="shifts"]')!.value,
  );

const day = (name: string) => screen.getByRole("group", { name });

function renderEditor({
  saved = false,
  outside = [],
  action = idle,
}: {
  saved?: boolean;
  outside?: OutsideBarber[];
  action?: (
    previous: ShopHoursState,
    formData: FormData,
  ) => Promise<ShopHoursState>;
} = {}) {
  return render(
    <ShopHoursEditor
      action={action}
      hours={DEFAULT_BARBERSHOP_HOURS}
      saved={saved}
      outside={outside}
    />,
  );
}

describe("ShopHoursEditor", () => {
  it("shows the seven days with their hours, Sunday closed", () => {
    renderEditor();
    expect(
      screen.getByRole("heading", { level: 1, name: t.titulo }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.bajada)).toBeInTheDocument();
    for (const name of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]) {
      const group = day(name);
      expect(
        within(group).getByRole("switch", { name: t.abre(name) }),
      ).toBeChecked();
      expect(
        within(group).getByRole("combobox", { name: h.desde }),
      ).toHaveValue("09:00");
      expect(
        within(group).getByRole("combobox", { name: h.hasta }),
      ).toHaveValue("20:00");
    }
    const sunday = within(day("Domingo")).getByRole("switch", {
      name: t.abre("Domingo"),
    });
    expect(sunday).not.toBeChecked();
    expect(sunday).toHaveAccessibleDescription(t.cerrado);
    expect(sentShifts()).toEqual(DEFAULT_BARBERSHOP_HOURS);
    expect(
      screen.getByRole("link", { name: textos.ui.volver }),
    ).toHaveAttribute("href", "/panel/mas");
    expect(screen.getByRole("button", { name: t.guardar })).toBeEnabled();
  });

  it("links to holidays and closures (D-59)", () => {
    renderEditor();
    const row = screen.getByRole("link", { name: /^Festivos y cierres/ });
    expect(row).toHaveAttribute("href", "/panel/horario/festivos");
    expect(row).toHaveTextContent(t.festivos);
    expect(row).toHaveTextContent(t.festivosDetalle);
  });

  it("opens a closed day, splits it and closes another", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(
      within(day("Domingo")).getByRole("switch", { name: t.abre("Domingo") }),
    );
    expect(
      within(day("Domingo")).getByRole("combobox", { name: h.desde }),
    ).toHaveValue("09:00");
    await user.click(
      within(day("Lunes")).getByRole("button", { name: h.partirDia("Lunes") }),
    );
    await user.click(
      within(day("Sábado")).getByRole("switch", { name: t.abre("Sábado") }),
    );
    expect(
      within(day("Sábado")).getByRole("switch", { name: t.abre("Sábado") }),
    ).toHaveAccessibleDescription(t.cerrado);

    const sent = sentShifts();
    expect(sent.filter((s) => s.weekday === 1)).toEqual([
      { weekday: 1, start: "09:00", end: "14:00" },
      { weekday: 1, start: "15:00", end: "20:00" },
    ]);
    expect(sent.filter((s) => s.weekday === 6)).toEqual([]);
    expect(sent.filter((s) => s.weekday === 0)).toEqual([
      { weekday: 0, start: "09:00", end: "18:00" },
    ]);
  });

  it("sends an empty week when every day closes, for the server to refuse", async () => {
    const user = userEvent.setup();
    renderEditor();
    for (const name of [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ]) {
      await user.click(
        within(day(name)).getByRole("switch", { name: t.abre(name) }),
      );
    }
    expect(sentShifts()).toEqual([]);
  });

  it("says when the hours were saved", () => {
    renderEditor({ saved: true });
    expect(
      screen.getByText(t.guardado).closest('[role="status"]'),
    ).not.toBeNull();
  });

  it("warns about barbers with hours outside, with a link to each schedule", () => {
    renderEditor({
      outside: [
        { id: "k", displayName: "Kevin" },
        { id: "a", displayName: "Ana" },
      ],
    });
    expect(screen.getByText(t.fuera(["Kevin", "Ana"]))).toBeInTheDocument();
    expect(t.fuera(["Kevin", "Ana"])).toBe(
      "Kevin y Ana tienen horas fuera de este horario",
    );
    expect(t.fuera(["Kevin"])).toBe("Kevin tiene horas fuera de este horario");
    expect(
      screen.getByRole("link", { name: h.titulo("Kevin") }),
    ).toHaveAttribute("href", "/panel/barberos/k/horario");
    expect(screen.getByRole("link", { name: h.titulo("Ana") })).toHaveAttribute(
      "href",
      "/panel/barberos/a/horario",
    );
  });

  it("shows no warning when every barber fits", () => {
    renderEditor();
    expect(screen.queryByText(t.fueraDetalle, { exact: false })).toBeNull();
  });

  it("shows the error the server sends back", async () => {
    const user = userEvent.setup();
    renderEditor({
      action: async () => ({
        status: "failed",
        error: "hours_required",
        values: { shifts: "[]" },
      }),
    });
    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.hours_required,
    );
  });

  it("marks the day the server finds wrong", async () => {
    const user = userEvent.setup();
    renderEditor({
      action: async () => ({
        status: "invalid",
        fieldErrors: { day1: "hours_overlap" },
        values: {},
      }),
    });
    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(
      await within(day("Lunes")).findByText(t.errores.hours_overlap),
    ).toBeInTheDocument();
    expect(
      within(day("Lunes")).getByRole("combobox", { name: h.desde }),
    ).toHaveAttribute("aria-invalid", "true");
  });
});

// Next.js keeps a page it leaves mounted and hidden (Activity) and shows the
// same instance again on coming back.
describe("ShopHoursEditor, hidden and shown again", () => {
  function inActivity(mode: "visible" | "hidden") {
    return (
      <Activity mode={mode}>
        <ShopHoursEditor
          action={async () => ({
            status: "failed",
            error: "hours_required",
            values: { shifts: "[]" },
          })}
          hours={DEFAULT_BARBERSHOP_HOURS}
          saved={false}
          outside={[]}
        />
      </Activity>
    );
  }

  it("starts again from the saved week, without the draft or its error", async () => {
    const user = userEvent.setup();
    const { rerender } = render(inActivity("visible"));
    await user.click(
      within(day("Lunes")).getByRole("switch", { name: t.abre("Lunes") }),
    );
    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.hours_required,
    );

    rerender(inActivity("hidden"));

    // Coming back is a later navigation, never the same task.

    await act(async () => {});
    rerender(inActivity("visible"));

    expect(
      within(day("Lunes")).getByRole("switch", { name: t.abre("Lunes") }),
    ).toBeChecked();
    expect(sentShifts()).toEqual(DEFAULT_BARBERSHOP_HOURS);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
