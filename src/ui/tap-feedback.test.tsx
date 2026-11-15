/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors on
   purpose: the listener works on any link, and a Link needs a router here. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PENDING_LIMIT_MS, TapFeedback } from "./tap-feedback";

const address = vi.hoisted(() => ({ pathname: "/panel", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => address.pathname,
  useSearchParams: () => new URLSearchParams(address.search),
}));

function Page() {
  return (
    <>
      <TapFeedback />
      <a href="/panel/clientes">Clientes</a>
      <a href="/panel?dia=2026-11-16">
        <span>Día siguiente</span>
      </a>
      <a href="/panel">Agenda</a>
      <a href="https://wa.me/573001112233">WhatsApp</a>
      <a href="/panel/cierre/csv" download>
        Descargar
      </a>
      <a href="/terminos" target="_blank">
        Términos
      </a>
      <form action="/panel/clientes" aria-label="Buscar">
        <input name="q" defaultValue="ana" />
        <button>Buscar</button>
      </form>
      <form action="/panel/horario" method="post" aria-label="Guardar">
        <button>Guardar</button>
      </form>
    </>
  );
}

// The links only mark themselves here: jsdom does not navigate.
const tap = (name: string, init?: MouseEventInit) =>
  fireEvent.click(screen.getByText(name), init);
const link = (name: string) => screen.getByText(name).closest("a")!;

// As the router does with its links: the browser never follows them itself.
const stay = (event: Event) => event.preventDefault();

describe("TapFeedback", () => {
  beforeEach(() => {
    address.pathname = "/panel";
    address.search = "";
    window.history.replaceState(null, "", "/panel");
    document.addEventListener("click", stay);
    document.addEventListener("submit", stay);
  });
  afterEach(() => {
    document.removeEventListener("click", stay);
    document.removeEventListener("submit", stay);
    vi.useRealTimers();
  });

  it("marks the tapped link at once", () => {
    render(<Page />);
    tap("Clientes");
    expect(link("Clientes")).toHaveAttribute("data-pending");
  });

  it("marks the link when the tap lands on something inside it", () => {
    render(<Page />);
    tap("Día siguiente");
    expect(link("Día siguiente")).toHaveAttribute("data-pending");
  });

  it("clears the mark when the screen arrives", () => {
    const { rerender } = render(<Page />);
    tap("Clientes");
    address.pathname = "/panel/clientes";
    rerender(<Page />);
    expect(link("Clientes")).not.toHaveAttribute("data-pending");
  });

  it("clears the mark when only the query changes", () => {
    const { rerender } = render(<Page />);
    tap("Día siguiente");
    address.search = "dia=2026-11-16";
    rerender(<Page />);
    expect(link("Día siguiente")).not.toHaveAttribute("data-pending");
  });

  it("moves the mark to the last link tapped", () => {
    render(<Page />);
    tap("Clientes");
    tap("Día siguiente");
    expect(link("Clientes")).not.toHaveAttribute("data-pending");
    expect(link("Día siguiente")).toHaveAttribute("data-pending");
  });

  it("gives up after a while, so a failed navigation does not stay marked", () => {
    vi.useFakeTimers();
    render(<Page />);
    tap("Clientes");
    act(() => {
      vi.advanceTimersByTime(PENDING_LIMIT_MS);
    });
    expect(link("Clientes")).not.toHaveAttribute("data-pending");
  });

  it("leaves alone the links that do not change the screen", () => {
    render(<Page />);
    for (const name of ["Agenda", "WhatsApp", "Descargar", "Términos"]) {
      tap(name);
      expect(link(name)).not.toHaveAttribute("data-pending");
    }
  });

  it("leaves alone a tap that opens another tab", () => {
    render(<Page />);
    tap("Clientes", { ctrlKey: true });
    tap("Clientes", { button: 1 });
    expect(link("Clientes")).not.toHaveAttribute("data-pending");
  });

  it("marks the button of a search until its results arrive", () => {
    const { rerender } = render(<Page />);
    fireEvent.submit(screen.getByRole("form", { name: "Buscar" }));
    const button = screen.getByRole("button", { name: "Buscar" });
    expect(button).toHaveAttribute("data-pending");
    address.pathname = "/panel/clientes";
    address.search = "q=ana";
    rerender(<Page />);
    expect(button).not.toHaveAttribute("data-pending");
  });

  it("leaves alone a search that would land on the address already open", () => {
    window.history.replaceState(null, "", "/panel/clientes?q=ana");
    render(<Page />);
    fireEvent.submit(screen.getByRole("form", { name: "Buscar" }));
    expect(screen.getByRole("button", { name: "Buscar" })).not.toHaveAttribute(
      "data-pending",
    );
  });

  it("leaves alone a form that saves: its button shows its own wait", () => {
    render(<Page />);
    fireEvent.submit(screen.getByRole("form", { name: "Guardar" }));
    expect(screen.getByRole("button", { name: "Guardar" })).not.toHaveAttribute(
      "data-pending",
    );
  });
});
