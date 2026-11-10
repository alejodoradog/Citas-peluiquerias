import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlusIcon } from "./icons";
import { textos } from "./textos";
import { TopBar, TopBarAction } from "./top-bar";

describe("TopBar", () => {
  it("shows the title and the subtitle", () => {
    render(<TopBar title="Tus servicios" subtitle="Paso 2 de 3" />);
    expect(screen.getByText("Tus servicios")).toHaveClass(
      "text-base",
      "font-bold",
    );
    expect(screen.getByText("Paso 2 de 3")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers a 44 px back link named by its label", () => {
    render(
      <TopBar
        title="Tu equipo"
        back={{ href: "/panel/configurar/servicios", label: textos.ui.volver }}
      />,
    );
    const link = screen.getByRole("link", { name: textos.ui.volver });
    expect(link).toHaveAttribute("href", "/panel/configurar/servicios");
    expect(link).toHaveClass("size-11");
    for (const svg of link.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("offers a close link instead of going back", () => {
    render(
      <TopBar
        title="Agregar barbero"
        close={{ href: "/panel/configurar/barberos", label: textos.ui.cerrar }}
      />,
    );
    expect(
      screen.getByRole("link", { name: textos.ui.cerrar }),
    ).toHaveAttribute("href", "/panel/configurar/barberos");
    expect(
      screen.queryByRole("link", { name: textos.ui.volver }),
    ).not.toBeInTheDocument();
  });

  it("places an action on the right", () => {
    render(
      <TopBar
        title="Servicios"
        action={
          <TopBarAction
            href="/panel/mas/servicios/nuevo"
            label="Agregar servicio"
            icon={<PlusIcon size={24} />}
          />
        }
      />,
    );
    const action = screen.getByRole("link", { name: "Agregar servicio" });
    expect(action).toHaveClass("size-11");
  });

  it("can be the page heading when the screen has no other", () => {
    render(<TopBar title="Barberos" titleAs="h1" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Barberos" }),
    ).toBeInTheDocument();
  });

  it("is at least 56 px tall", () => {
    const { container } = render(<TopBar title="Compartir" />);
    expect(container.firstElementChild).toHaveClass("min-h-14");
  });
});
