import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { textos } from "@/ui/textos";
import { ServicesStep } from "./services-step";
import { SetupDraftProvider } from "./setup-draft";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => "/panel/configurar",
  useSearchParams: () => new URLSearchParams(),
}));

const t = textos.asistente;

function renderStep() {
  return render(
    <SetupDraftProvider barbershopId="sede-de-prueba">
      <ServicesStep />
    </SetupDraftProvider>,
  );
}

// The row is a button named by "Editar" and everything it shows.
const row = (name: string) =>
  screen.getByRole("button", {
    name: new RegExp(`${t.servicios.editar}\\s*${name}`),
  });

// Task 7.3: the wizard starts with two placeholders that name no trade, and
// does not go on until each is filled in or unchecked.
describe("ServicesStep", () => {
  it("starts with two services to fill in, and waits for them", async () => {
    window.sessionStorage.clear();
    renderStep();
    expect(await screen.findByText(t.servicios.titulo)).toBeVisible();
    for (const name of ["Servicio 1", "Servicio 2"]) {
      expect(row(name)).toHaveTextContent(t.servicios.porCompletar);
      expect(row(name)).not.toHaveTextContent("$");
    }
    expect(
      screen.getByText(t.servicios.pendientes("Servicio 1 y Servicio 2")),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: t.servicios.continuar }),
    ).toBeDisabled();
  });

  it("goes on once each one has a price or is unchecked", async () => {
    window.sessionStorage.clear();
    renderStep();
    await userEvent.click(row("Servicio 1"));
    const sheet = await screen.findByRole("dialog", {
      name: t.servicio.editar,
    });
    // The placeholder brings its name and no price.
    const name = within(sheet).getByLabelText(t.servicio.campos.nombre);
    const price = within(sheet).getByLabelText(t.servicio.campos.precio);
    expect(name).toHaveValue("Servicio 1");
    expect(price).toHaveValue("");
    await userEvent.clear(name);
    await userEvent.type(name, "Consulta");
    await userEvent.type(price, "80000");
    await userEvent.click(
      within(sheet).getByRole("button", { name: t.servicio.guardar }),
    );

    expect(
      await screen.findByText(t.servicios.pendientes("Servicio 2")),
    ).toBeVisible();
    expect(row("Consulta")).toHaveTextContent("$80.000");

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: t.servicios.ofrecer("Servicio 2"),
      }),
    );
    expect(
      screen.getByRole("link", { name: t.servicios.continuar }),
    ).toHaveAttribute("href", "/panel/configurar/equipo");
  });
});
