import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PoliciesState } from "@/modulos/barberias/acciones/policies";
import { textos } from "@/ui/textos";
import { PoliciesForm } from "./policies-form";

const t = textos.politicas;

const idle = async (): Promise<PoliciesState> => ({ status: "idle" });

const defaults = { minBookingNoticeMinutes: 60, cancellationNoticeHours: 2 };

describe("PoliciesForm", () => {
  it("shows the saved policies, the fixed window and what the owner can always do", () => {
    render(<PoliciesForm action={idle} saved={defaults} />);
    expect(
      screen.getByRole("heading", { level: 1, name: t.titulo }),
    ).toBeInTheDocument();
    const notice = screen.getByRole("combobox", { name: t.anticipacion });
    expect(notice).toHaveValue("60");
    expect(notice).toHaveAccessibleDescription(t.anticipacionAyuda);
    expect(
      within(notice).getByRole("option", { selected: true }),
    ).toHaveTextContent("1 hora antes");
    const cancel = screen.getByRole("combobox", { name: t.cancelar });
    expect(cancel).toHaveValue("2");
    expect(cancel).toHaveAccessibleDescription(t.cancelarAyuda);
    expect(
      within(cancel).getByRole("option", { selected: true }),
    ).toHaveTextContent("2 horas antes");
    expect(screen.getByText(t.ventana)).toBeInTheDocument();
    expect(screen.getByText("30 días hacia adelante")).toBeInTheDocument();
    expect(screen.getByText(t.siempre)).toBeInTheDocument();
    expect(screen.getByText(t.siempreDetalle)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: textos.ui.volver }),
    ).toHaveAttribute("href", "/panel/mas");
    expect(screen.getByRole("button", { name: t.guardar })).toBeEnabled();
  });

  it("names every option as people say it", () => {
    render(<PoliciesForm action={idle} saved={defaults} />);
    expect(
      within(screen.getByRole("combobox", { name: t.anticipacion }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Sin anticipación",
      "15 minutos antes",
      "30 minutos antes",
      "1 hora antes",
      "2 horas antes",
      "3 horas antes",
      "6 horas antes",
      "12 horas antes",
      "1 día antes",
      "2 días antes",
    ]);
    expect(
      within(screen.getByRole("combobox", { name: t.cancelar }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "La hora de la cita",
      "1 hora antes",
      "2 horas antes",
      "3 horas antes",
      "4 horas antes",
      "6 horas antes",
      "12 horas antes",
      "1 día antes",
      "2 días antes",
    ]);
  });

  it("shows a saved value that is not one of the options", () => {
    render(
      <PoliciesForm
        action={idle}
        saved={{ minBookingNoticeMinutes: 90, cancellationNoticeHours: 5 }}
      />,
    );
    expect(screen.getByRole("combobox", { name: t.anticipacion })).toHaveValue(
      "90",
    );
    expect(
      screen.getByRole("option", { name: "90 minutos antes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: t.cancelar })).toHaveValue("5");
    expect(
      screen.getByRole("option", { name: "5 horas antes" }),
    ).toBeInTheDocument();
  });

  it("sends the chosen values", async () => {
    const user = userEvent.setup();
    let sent: FormData | null = null;
    render(
      <PoliciesForm
        action={async (_previous, formData) => {
          sent = formData;
          return { status: "idle" };
        }}
        saved={defaults}
      />,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: t.anticipacion }),
      "180",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: t.cancelar }),
      "24",
    );
    await user.click(screen.getByRole("button", { name: t.guardar }));
    await screen.findByRole("button", { name: t.guardar });
    expect(sent).not.toBeNull();
    expect(sent!.get("minBookingNotice")).toBe("180");
    expect(sent!.get("cancellationNotice")).toBe("24");
  });

  it("keeps the choice and shows the error the server sends back", async () => {
    const user = userEvent.setup();
    render(
      <PoliciesForm
        action={async () => ({
          status: "invalid",
          fieldErrors: { cancellationNotice: "cancellation_notice_invalid" },
          values: { minBookingNotice: "180", cancellationNotice: "2" },
        })}
        saved={defaults}
      />,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: t.anticipacion }),
      "180",
    );
    await user.click(screen.getByRole("button", { name: t.guardar }));
    const cancel = screen.getByRole("combobox", { name: t.cancelar });
    expect(
      await screen.findByText(t.errores.cancellation_notice_invalid),
    ).toBeInTheDocument();
    expect(cancel).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("combobox", { name: t.anticipacion })).toHaveValue(
      "180",
    );
  });
});
