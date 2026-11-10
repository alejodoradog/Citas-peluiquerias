import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionBar } from "./action-bar";
import { BrandHeader } from "./brand";
import { Card } from "./card";
import { Fab } from "./fab";
import { List, ListRow } from "./list";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { Steps } from "./steps";
import { textos } from "./textos";

describe("BrandHeader", () => {
  it("names the product and links home", () => {
    render(<BrandHeader />);
    expect(screen.getByRole("link", { name: "Yapoin" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("Card and ActionBar", () => {
  it("render their content", () => {
    render(
      <>
        <Card>Contenido</Card>
        <ActionBar>
          <button type="button">Seguir</button>
        </ActionBar>
      </>,
    );
    expect(screen.getByText("Contenido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seguir" })).toBeInTheDocument();
  });
});

describe("List", () => {
  it("makes a row with href one link named by its content", () => {
    render(
      <List>
        <ListRow
          href="/servicios/1"
          title="Corte"
          subtitle="40 min"
          trailing={<strong>$25.000</strong>}
        />
        <ListRow title="Barba" subtitle="20 min" />
      </List>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const link = within(items[0]!).getByRole("link");
    expect(link).toHaveAccessibleName("Corte 40 min $25.000");
    expect(within(items[1]!).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("Steps", () => {
  it("tells screen readers the current step", () => {
    render(<Steps current={1} total={3} />);
    expect(screen.getByText("Paso 1 de 3")).toBeInTheDocument();
  });
});

describe("Fab", () => {
  it("is named by its label, not by its icon", () => {
    render(<Fab href="/panel/nueva" label={textos.ui.nuevaCita} />);
    expect(
      screen.getByRole("link", { name: textos.ui.nuevaCita }),
    ).toHaveAttribute("href", "/panel/nueva");
  });
});

describe("states", () => {
  it("shows an empty state with its action", () => {
    render(
      <EmptyState
        title="Estado vacío"
        action={<button type="button">Crear cita</button>}
      >
        Una frase.
      </EmptyState>,
    );
    expect(screen.getByText("Estado vacío")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear cita" }),
    ).toBeInTheDocument();
  });

  it("tells screen readers it is loading, without a spinner", () => {
    render(<LoadingState />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent(textos.ui.cargando);
  });

  it("announces an error and offers to try again", async () => {
    const reset = vi.fn();
    render(
      <ErrorState
        title="Algo salió mal"
        action={
          <button type="button" onClick={reset}>
            Intentar de nuevo
          </button>
        }
      >
        No pudimos cargar esta página.
      </ErrorState>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal");
    await userEvent.click(
      screen.getByRole("button", { name: "Intentar de nuevo" }),
    );
    expect(reset).toHaveBeenCalledOnce();
  });
});
