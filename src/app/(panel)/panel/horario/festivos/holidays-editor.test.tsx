import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  ClosureCommandResult,
  ClosureState,
  HolidaysState,
} from "@/modulos/barberias/acciones/holidays";
import { textos } from "@/ui/textos";
import { HolidaysEditor, type ListedClosure } from "./holidays-editor";

const t = textos.festivos;

const HOLIDAYS = [
  { date: "2026-11-16", keys: ["cartagena_independence" as const] },
  { date: "2026-12-08", keys: ["immaculate_conception" as const] },
  { date: "2026-12-25", keys: ["christmas" as const] },
  { date: "2027-01-01", keys: ["new_year" as const] },
];

const NOCHEBUENA: ListedClosure = {
  id: "cccccccc-0000-4000-8000-000000000000",
  title: "Jueves 24 de diciembre · desde 2:00 p. m.",
  reason: "Nochebuena",
};

const idle = async (): Promise<HolidaysState> => ({ status: "idle" });
const idleClosure = async (): Promise<ClosureState> => ({ status: "idle" });
const removed = async (): Promise<ClosureCommandResult> => ({ ok: true });

function renderEditor(
  props: Partial<Parameters<typeof HolidaysEditor>[0]> = {},
) {
  return render(
    <HolidaysEditor
      action={idle}
      addAction={idleClosure}
      removeAction={removed}
      holidays={HOLIDAYS}
      opened={["2026-11-16"]}
      closures={[NOCHEBUENA]}
      today="2026-11-10"
      saved={false}
      {...props}
    />,
  );
}

describe("HolidaysEditor", () => {
  it("shows each holiday with its switch, closed unless opened", () => {
    renderEditor();
    expect(
      screen.getByRole("heading", { level: 1, name: t.titulo }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: t.festivos }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.bajada)).toBeInTheDocument();
    const cartagena = screen.getByRole("switch", {
      name: "Lunes 16 de noviembre",
    });
    expect(cartagena).toBeChecked();
    expect(cartagena).toHaveAccessibleDescription("Independencia de Cartagena");
    expect(cartagena).toHaveAttribute("name", "open");
    expect(cartagena).toHaveAttribute("value", "2026-11-16");
    expect(
      screen.getByRole("switch", { name: "Viernes 25 de diciembre" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Viernes 1 de enero" }),
    ).toHaveAccessibleDescription("Año Nuevo");
    expect(
      screen.getByRole("link", { name: textos.ui.volver }),
    ).toHaveAttribute("href", "/panel/horario");
    expect(screen.getByRole("button", { name: t.guardar })).toBeEnabled();
  });

  it("sends the holidays switched on with Guardar", async () => {
    const user = userEvent.setup();
    const action = vi.fn<
      (previous: HolidaysState, formData: FormData) => Promise<HolidaysState>
    >(idle);
    renderEditor({ action });
    await user.click(
      screen.getByRole("switch", { name: "Viernes 25 de diciembre" }),
    );
    await user.click(
      screen.getByRole("switch", { name: "Lunes 16 de noviembre" }),
    );
    await user.click(screen.getByRole("button", { name: t.guardar }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    const sent = action.mock.calls[0]![1];
    expect(sent.getAll("open")).toEqual(["2026-12-25"]);
  });

  it("says when the holidays were saved", () => {
    renderEditor({ saved: true });
    expect(screen.getByRole("status")).toHaveTextContent(t.guardado);
  });

  it("says when they could not be saved", async () => {
    const user = userEvent.setup();
    renderEditor({
      action: async () => ({ status: "failed", error: "unknown", values: {} }),
    });
    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.unknown,
    );
  });

  it("lists the closures of the whole barbershop with their reason", () => {
    renderEditor();
    expect(
      screen.getByRole("heading", { level: 2, name: t.cierres }),
    ).toBeInTheDocument();
    expect(screen.getByText(NOCHEBUENA.title)).toBeInTheDocument();
    expect(
      screen.getByText(`${t.todaLaBarberia} · Nochebuena`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: t.borrar(NOCHEBUENA.title) }),
    ).toBeInTheDocument();
  });

  it("says when there are no closures", () => {
    renderEditor({ closures: [] });
    expect(screen.getByText(t.sinCierres)).toBeInTheDocument();
  });

  it("removes a closure only after confirming", async () => {
    const user = userEvent.setup();
    const removeAction = vi.fn(removed);
    renderEditor({ removeAction });
    await user.click(
      screen.getByRole("button", { name: t.borrar(NOCHEBUENA.title) }),
    );
    const dialog = screen.getByRole("dialog", { name: t.confirmar.titulo });
    expect(within(dialog).getByText(NOCHEBUENA.title)).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: t.confirmar.no }),
    );
    expect(removeAction).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: t.borrar(NOCHEBUENA.title) }),
    );
    await user.click(
      within(
        screen.getByRole("dialog", { name: t.confirmar.titulo }),
      ).getByRole("button", { name: t.confirmar.si }),
    );
    expect(removeAction).toHaveBeenCalledWith(NOCHEBUENA.id);
  });

  it("keeps the confirmation open when removing fails", async () => {
    const user = userEvent.setup();
    renderEditor({
      removeAction: async () => ({ ok: false, error: "unknown" }),
    });
    await user.click(
      screen.getByRole("button", { name: t.borrar(NOCHEBUENA.title) }),
    );
    const dialog = screen.getByRole("dialog", { name: t.confirmar.titulo });
    await user.click(
      within(dialog).getByRole("button", { name: t.confirmar.si }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      t.confirmar.fallo,
    );
  });

  it("adds a closure from its sheet, whole days by default", async () => {
    const user = userEvent.setup();
    const addAction = vi.fn(async (): Promise<ClosureState> => ({
      status: "done",
      notice: "closure_added",
    }));
    renderEditor({ addAction });
    await user.click(screen.getByRole("button", { name: t.agregar }));
    const sheet = screen.getByRole("dialog", { name: t.hoja.titulo });
    const allDay = within(sheet).getByRole("switch", {
      name: t.hoja.todoElDia,
    });
    expect(allDay).toBeChecked();
    expect(within(sheet).getByLabelText(t.hoja.desdeFecha)).toHaveValue(
      "2026-11-10",
    );
    expect(within(sheet).queryByRole("combobox")).toBeNull();

    await user.click(allDay);
    const from = within(sheet).getByRole("combobox", {
      name: t.hoja.desdeHora,
    });
    const to = within(sheet).getByRole("combobox", { name: t.hoja.hastaHora });
    await user.selectOptions(from, "14:00");
    expect(
      within(to).getByRole("option", { selected: true }),
    ).toHaveTextContent(t.opcionMedianoche);
    await user.type(
      within(sheet).getByRole("textbox", { name: /Motivo/ }),
      "Nochebuena",
    );
    await user.click(
      within(sheet).getByRole("button", { name: t.hoja.guardar }),
    );

    await waitFor(() => expect(addAction).toHaveBeenCalled());
    const sent = addAction.mock.calls[0] as unknown as [unknown, FormData];
    expect(Object.fromEntries(sent[1])).toEqual({
      fromDate: "2026-11-10",
      toDate: "2026-11-10",
      fromTime: "14:00",
      toTime: "24:00",
      reason: "Nochebuena",
    });
    expect(await screen.findByText(t.agregado)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: t.hoja.titulo })).toBeNull();
  });

  it("shows what to fix in the sheet", async () => {
    const user = userEvent.setup();
    renderEditor({
      addAction: async () => ({
        status: "invalid",
        fieldErrors: { toDate: "closure_order" },
        values: { fromDate: "2026-12-24", toDate: "2026-12-23" },
      }),
    });
    await user.click(screen.getByRole("button", { name: t.agregar }));
    const sheet = screen.getByRole("dialog", { name: t.hoja.titulo });
    await user.click(
      within(sheet).getByRole("button", { name: t.hoja.guardar }),
    );
    expect(
      await within(sheet).findByText(t.hoja.errores.closure_order),
    ).toBeInTheDocument();
  });
});

describe("HolidaysEditor, hidden and shown again", () => {
  const inActivity = (mode: "visible" | "hidden") => (
    <Activity mode={mode}>
      <HolidaysEditor
        action={idle}
        addAction={idleClosure}
        removeAction={removed}
        holidays={HOLIDAYS}
        opened={["2026-11-16"]}
        closures={[]}
        today="2026-11-10"
        saved={false}
      />
    </Activity>
  );

  it("starts again from the saved holidays, not from the draft", async () => {
    const user = userEvent.setup();
    const { rerender } = render(inActivity("visible"));
    await user.click(
      screen.getByRole("switch", { name: "Viernes 25 de diciembre" }),
    );
    rerender(inActivity("hidden"));
    rerender(inActivity("visible"));
    expect(
      screen.getByRole("switch", { name: "Viernes 25 de diciembre" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Lunes 16 de noviembre" }),
    ).toBeChecked();
  });
});
