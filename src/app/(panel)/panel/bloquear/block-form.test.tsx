import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { addDays, fromBogota, type BogotaDate } from "@/lib/fechas/fechas";
import { IDLE } from "@/lib/formularios/form-state";
import { textos } from "@/ui/textos";

const gate = vi.hoisted(() => ({ release: () => undefined as void }));

// A block that stays unresolved until the test lets it go.
vi.mock("@/modulos/agenda/acciones/owner-appointment", () => ({
  createOwnerBlockAction: async () => {
    await new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    return IDLE;
  },
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const { OwnerBlockForm } = await import("./block-form");
const t = textos.agenda.bloquear;

const TODAY = "2027-03-01" as BogotaDate;
const DAYS = [0, 1, 2, 3].map((n) => addDays(TODAY, n));
const ANA = "bbbbbbbb-0000-4000-8000-000000000002";
const OWNER = { id: "bbbbbbbb-0000-4000-8000-000000000001", name: "Carlos" };

function renderForm(props: Partial<Parameters<typeof OwnerBlockForm>[0]> = {}) {
  return render(
    <OwnerBlockForm
      owner={OWNER}
      barbers={[{ id: ANA, name: "Ana" }]}
      days={DAYS.map((date) => ({ value: date, label: date }))}
      closed={{ mine: [DAYS[2]!], barbers: { [ANA]: [] }, shop: [DAYS[3]!] }}
      times={["09:00", "10:00", "11:00", "12:00"].map((time) => ({
        value: time,
        label: time,
      }))}
      appointments={[
        {
          barberId: ANA,
          start: fromBogota(DAYS[1]!, "10:00"),
          end: fromBogota(DAYS[1]!, "10:30"),
          customerName: "Mateo R.",
        },
      ]}
      today={TODAY}
      now={fromBogota(TODAY, "08:00")}
      defaults={{
        para: "mine",
        profesional: ANA,
        dia: DAYS[1]!,
        desde: "10:00",
        hasta: "11:00",
      }}
      {...props}
    />,
  );
}

const dayOption = (date: string) =>
  within(screen.getByRole("combobox", { name: t.dia })).getByRole("option", {
    name: new RegExp(`^${date}`),
  });

describe("OwnerBlockForm (task 8.14)", () => {
  it("offers Mi agenda first and chosen, each choice saying what happens", () => {
    renderForm();
    const radios = within(
      screen.getByRole("group", { name: t.para }),
    ).getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual([
      "mine",
      "barber",
      "shop",
    ]);
    expect(
      screen.getByRole("radio", { name: t.opciones.mine.titulo }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: t.opciones.mine.titulo }),
    ).toHaveAccessibleDescription(t.opciones.mine.ayuda);
    expect(
      screen.getByRole("radio", { name: t.opciones.shop.titulo }),
    ).toHaveAccessibleDescription(t.opciones.shop.ayuda);
    expect(screen.getByRole("button", { name: t.enviarMia })).toBeEnabled();
    // The professional's picker only for "Un profesional".
    expect(
      screen.queryByRole("combobox", { name: t.profesional }),
    ).not.toBeInTheDocument();
  });

  it("has no Mi agenda for an owner who does not attend, nor Un profesional without others", () => {
    renderForm({
      owner: null,
      barbers: [],
      defaults: {
        para: "shop",
        profesional: "",
        dia: DAYS[1]!,
        desde: "10:00",
        hasta: "11:00",
      },
    });
    expect(
      within(screen.getByRole("group", { name: t.para }))
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["shop"]);
    expect(
      screen.getByRole("button", { name: t.enviarEstablecimiento }),
    ).toBeInTheDocument();
  });

  it("switches the button, the warning and the closed days with the choice", async () => {
    renderForm();
    // Mi agenda: day 2 is closed for the owner, day 3 is not.
    expect(dayOption(DAYS[2]!)).toBeDisabled();
    expect(dayOption(DAYS[2]!)).toHaveTextContent(
      textos.barbero.bloquear.diaCerrado(DAYS[2]!),
    );
    expect(dayOption(DAYS[3]!)).toBeEnabled();

    await userEvent.click(
      screen.getByRole("radio", { name: t.opciones.barber.titulo }),
    );
    expect(screen.getByRole("combobox", { name: t.profesional })).toHaveValue(
      ANA,
    );
    // Ana has an appointment at 10:00 that day: the button waits.
    expect(screen.getByText(t.conCitas("Ana", 1))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: t.enviarA("Ana") }),
    ).toBeDisabled();
    expect(dayOption(DAYS[2]!)).toBeEnabled();

    await userEvent.click(
      screen.getByRole("radio", { name: t.opciones.shop.titulo }),
    );
    expect(screen.getByText(t.conCitasTodos(1))).toBeInTheDocument();
    expect(dayOption(DAYS[3]!)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: t.enviarEstablecimiento }),
    ).toBeDisabled();

    // The owner's own agenda has no appointment in the way.
    await userEvent.click(
      screen.getByRole("radio", { name: t.opciones.mine.titulo }),
    );
    expect(screen.queryByText(t.conCitasMia(1))).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.enviarMia })).toBeEnabled();
  });

  it("leaves a day that is closed for the new choice for the first open one", async () => {
    renderForm({
      defaults: {
        para: "barber",
        profesional: ANA,
        dia: DAYS[2]!,
        desde: "10:00",
        hasta: "11:00",
      },
    });
    expect(screen.getByRole("combobox", { name: t.dia })).toHaveValue(DAYS[2]);
    await userEvent.click(
      screen.getByRole("radio", { name: t.opciones.mine.titulo }),
    );
    expect(screen.getByRole("combobox", { name: t.dia })).toHaveValue(DAYS[0]);
  });

  it("hides the hours for Todo el día and counts the whole day in the warning", async () => {
    renderForm({
      defaults: {
        para: "barber",
        profesional: ANA,
        dia: DAYS[1]!,
        desde: "12:00",
        hasta: "12:00",
      },
    });
    expect(screen.queryByText(t.conCitas("Ana", 1))).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: t.todoElDia }));
    expect(
      screen.getByRole("checkbox", { name: t.todoElDia }),
    ).toHaveAccessibleDescription(t.todoElDiaAyuda.barber);
    // Hidden with the class "hidden" (no CSS in the test).
    expect(
      screen.getByRole("combobox", { name: t.desde }).closest(".grid"),
    ).toHaveClass("hidden");
    expect(screen.getByText(t.conCitas("Ana", 1))).toBeInTheDocument();
  });

  it("locks the button and says it is saving from the tap", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("radio", { name: "Diligencia" }));
    await userEvent.click(screen.getByRole("button", { name: t.enviarMia }));
    expect(
      await screen.findByRole("button", { name: t.enviando }),
    ).toBeDisabled();
    gate.release();
  });
});
