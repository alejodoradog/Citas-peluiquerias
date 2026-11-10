import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowShell } from "./flow-shell";
import { TopBar } from "./top-bar";

describe("FlowShell", () => {
  it("puts the header, the content and the actions in order", () => {
    render(
      <FlowShell
        header={<TopBar title="Tus servicios" subtitle="Paso 2 de 3" />}
        actions={<button type="button">Continuar</button>}
      >
        <h1>¿Qué servicios ofreces?</h1>
      </FlowShell>,
    );
    const main = screen.getByRole("main");
    expect(main).toContainElement(
      screen.getByRole("heading", {
        level: 1,
        name: "¿Qué servicios ofreces?",
      }),
    );
    expect(main).not.toContainElement(screen.getByText("Tus servicios"));
    const button = screen.getByRole("button", { name: "Continuar" });
    expect(main).not.toContainElement(button);
    // The actions stay on screen while the content scrolls.
    expect(button.closest(".sticky")).toHaveClass("bottom-0");
  });

  it("shows no action bar without actions", () => {
    const { container } = render(
      <FlowShell header={<TopBar title="Listo" />}>
        <p>Contenido</p>
      </FlowShell>,
    );
    expect(container.querySelector(".sticky")).toBeNull();
  });

  it("has no brand and no bottom bar", () => {
    render(
      <FlowShell header={<TopBar title="Listo" />}>
        <p>Contenido</p>
      </FlowShell>,
    );
    expect(screen.queryByText("Yapoin")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
