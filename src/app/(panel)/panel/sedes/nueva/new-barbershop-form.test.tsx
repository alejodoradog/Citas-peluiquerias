import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NewBarbershopState } from "@/modulos/barberias/acciones/barbershops";
import { textos } from "@/ui/textos";
import { NewBarbershopForm } from "./new-barbershop-form";

const t = textos.sedes.nuevaSede;
const REQUEST_ID = "0b6a3c1e-8f7d-4c2a-9e5b-1d2f3a4b5c6d";
const trial = { until: "24 de noviembre", ended: false };

describe("NewBarbershopForm", () => {
  it("asks for the name and an optional WhatsApp, and says the trial is shared", () => {
    render(
      <NewBarbershopForm
        action={async () => ({ status: "idle" })}
        requestId={REQUEST_ID}
        trial={trial}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t.titulo }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: textos.ui.volver }),
    ).toHaveAttribute("href", "/panel/mas");
    expect(
      screen.getByRole("textbox", { name: t.campos.nombre }),
    ).toHaveAccessibleDescription(t.ayudas.nombre);
    expect(
      screen.getByRole("textbox", { name: /WhatsApp de la sede/ }),
    ).toHaveAccessibleDescription(t.ayudas.whatsapp);
    expect(screen.getByRole("status")).toHaveTextContent(t.prueba);
    expect(screen.getByRole("status")).toHaveTextContent(
      t.pruebaHasta("24 de noviembre"),
    );
    expect(screen.getByRole("button", { name: t.crear })).toBeEnabled();
  });

  it("warns that a sede created after the trial waits for its first payment", () => {
    render(
      <NewBarbershopForm
        action={async () => ({ status: "idle" })}
        requestId={REQUEST_ID}
        trial={{ until: "24 de noviembre", ended: true }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(t.pruebaVencida);
    expect(screen.queryByText(t.prueba)).not.toBeInTheDocument();
  });

  it("sends the request id made by the server with the form", async () => {
    const action = vi.fn(
      async (_previous: NewBarbershopState, data: FormData) => {
        expect(data.get("requestId")).toBe(REQUEST_ID);
        expect(data.get("name")).toBe("El Parche Sur");
        return { status: "idle" } as const;
      },
    );
    render(
      <NewBarbershopForm
        action={action}
        requestId={REQUEST_ID}
        trial={trial}
      />,
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: t.campos.nombre }),
      "El Parche Sur",
    );
    await userEvent.click(screen.getByRole("button", { name: t.crear }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("shows what to fix and keeps what was typed", async () => {
    render(
      <NewBarbershopForm
        action={async () => ({
          status: "invalid",
          fieldErrors: { whatsappPhone: "phone_invalid" },
          values: { name: "El Parche Sur", whatsappPhone: "601 123" },
        })}
        requestId={REQUEST_ID}
        trial={trial}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: t.crear }));
    const phone = await screen.findByRole("textbox", {
      name: /WhatsApp de la sede/,
    });
    await waitFor(() =>
      expect(phone).toHaveAccessibleDescription(t.errores.phone_invalid),
    );
    expect(phone).toHaveValue("601 123");
    expect(phone).toHaveFocus();
    expect(screen.getByRole("textbox", { name: t.campos.nombre })).toHaveValue(
      "El Parche Sur",
    );
  });

  it("says when the sede could not be created", async () => {
    render(
      <NewBarbershopForm
        action={async () => ({
          status: "failed",
          error: "unknown",
          values: { name: "El Parche Sur", whatsappPhone: "" },
        })}
        requestId={REQUEST_ID}
        trial={trial}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: t.crear }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.unknown,
    );
  });

  it("loads the new sede's setup wizard in full once it is created", async () => {
    const goTo = vi.fn();
    render(
      <NewBarbershopForm
        action={async () => ({ status: "done", notice: "created" })}
        requestId={REQUEST_ID}
        trial={trial}
        goTo={goTo}
      />,
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: t.campos.nombre }),
      "El Parche Sur",
    );
    await userEvent.click(screen.getByRole("button", { name: t.crear }));
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/panel/configurar"));
    expect(goTo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: t.creando })).toBeDisabled();
  });
});
