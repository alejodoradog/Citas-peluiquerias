import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ServiceState } from "@/modulos/barberias/acciones/services";
import { textos } from "@/ui/textos";
import { ServiceEditor } from "./service-editor";

const t = textos.servicios;
const MARIO = "00000000-0000-0000-0000-00000000000a";
const KEVIN = "00000000-0000-0000-0000-00000000000b";
const barbers = [
  { id: MARIO, displayName: "Mario" },
  { id: KEVIN, displayName: "Kevin" },
];

// A fake Server Action that echoes the form like the real one and rejects
// every price, so the form comes back with an error.
async function rejectPrice(
  _previous: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  return {
    status: "invalid",
    fieldErrors: { price: "service_price_invalid" },
    values: {
      name: String(formData.get("name")),
      price: String(formData.get("price")),
      duration: String(formData.get("duration")),
      barberIds: formData.getAll("barberIds").join(","),
      active: formData.get("active") === "on" ? "on" : "",
    },
  };
}

async function failSaving(): Promise<ServiceState> {
  return { status: "failed", error: "unknown", values: {} };
}

describe("ServiceEditor", () => {
  it("starts a new service at 30 minutes, done by every active barber", () => {
    render(
      <ServiceEditor action={rejectPrice} service={null} barbers={barbers} />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t.nuevo }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(t.campos.duracion)).toHaveValue("30");
    expect(screen.getByRole("checkbox", { name: "Mario" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Kevin" })).toBeChecked();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: textos.ui.cerrar }),
    ).toHaveAttribute("href", "/panel/servicios");
  });

  it("shows an existing service as saved, with its switch", () => {
    render(
      <ServiceEditor
        action={rejectPrice}
        service={{
          id: "00000000-0000-0000-0000-000000000001",
          name: "Corte",
          priceCop: 25_000,
          durationMinutes: 40,
          active: false,
          barberIds: [KEVIN],
        }}
        barbers={barbers}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t.editar }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(t.campos.nombre)).toHaveValue("Corte");
    expect(screen.getByLabelText(t.campos.precio)).toHaveValue("25.000");
    expect(screen.getByLabelText(t.campos.duracion)).toHaveValue("40");
    expect(screen.getByRole("checkbox", { name: "Mario" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Kevin" })).toBeChecked();
    const active = screen.getByRole("switch", { name: t.activo });
    expect(active).not.toBeChecked();
    expect(active).toHaveAccessibleDescription(t.activoAyuda);
  });

  it("keeps what the owner chose when the form comes back with an error", async () => {
    const user = userEvent.setup();
    render(
      <ServiceEditor action={rejectPrice} service={null} barbers={barbers} />,
    );
    await user.type(screen.getByLabelText(t.campos.nombre), "Tinte");
    await user.type(screen.getByLabelText(t.campos.precio), "25,5");
    await user.click(screen.getByRole("checkbox", { name: "Kevin" }));
    await user.click(screen.getByRole("button", { name: t.guardar }));

    const price = await screen.findByLabelText(t.campos.precio);
    await waitFor(() => expect(price).toHaveAttribute("aria-invalid", "true"));
    expect(price).toHaveAccessibleDescription(t.errores.service_price_invalid);
    await waitFor(() => expect(price).toHaveFocus());
    expect(screen.getByLabelText(t.campos.nombre)).toHaveValue("Tinte");
    expect(screen.getByRole("checkbox", { name: "Mario" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Kevin" })).not.toBeChecked();
  });

  it("explains when saving failed", async () => {
    const user = userEvent.setup();
    render(
      <ServiceEditor action={failSaving} service={null} barbers={barbers} />,
    );
    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.unknown,
    );
  });

  it("says where to add barbers when there are none", () => {
    render(<ServiceEditor action={rejectPrice} service={null} barbers={[]} />);
    expect(screen.getByText(t.sinBarberos)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
