import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TabShell } from "./tab-shell";
import { textos } from "./textos";

vi.mock("next/navigation", () => ({ usePathname: () => "/panel/compartir" }));

describe("TabShell", () => {
  it("titles the screen in its top bar, with no way back", () => {
    render(
      <TabShell title="Compartir" subtitle="Tu link de reservas">
        <p>Contenido</p>
      </TabShell>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Compartir" }),
    ).toHaveClass("text-base", "font-bold");
    expect(screen.getByText("Tu link de reservas")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: textos.ui.volver }),
    ).not.toBeInTheDocument();
  });

  it("leaves room under the content for the bottom bar", () => {
    render(
      <TabShell title="Más">
        <p>Contenido</p>
      </TabShell>,
    );
    const main = screen.getByRole("main");
    expect(main).toContainElement(screen.getByText("Contenido"));
    expect(main).toHaveClass("pb-28");
    expect(main).not.toContainElement(
      screen.getByRole("heading", { level: 1, name: "Más" }),
    );
    const nav = screen.getByRole("navigation", {
      name: textos.ui.navegacion.etiqueta,
    });
    expect(
      screen.getByRole("link", { name: textos.ui.navegacion.compartir }),
    ).toHaveAttribute("aria-current", "page");
    expect(main).not.toContainElement(nav);
  });

  it("has no brand and no sign-out button", () => {
    render(
      <TabShell title="Más">
        <p>Contenido</p>
      </TabShell>,
    );
    expect(screen.queryByText("Yapoin")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: textos.cuentas.salir }),
    ).not.toBeInTheDocument();
  });
});
