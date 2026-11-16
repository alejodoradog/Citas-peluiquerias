import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startTransition } from "react";
import { describe, expect, it, vi } from "vitest";
import { initialDraft } from "@/modulos/barberias/dominio/setup";
import { textos } from "@/ui/textos";

const gate = vi.hoisted(() => {
  const state: { release: () => void; search: string } = {
    release: () => undefined,
    search: "",
  };
  return state;
});

// The team screen "loads" until the test lets it go, as a real navigation
// does inside a transition.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () =>
      startTransition(async () => {
        await new Promise<void>((resolve) => {
          gate.release = resolve;
        });
      }),
  }),
  useSearchParams: () => new URLSearchParams(gate.search),
  usePathname: () => "/panel/configurar/equipo/barbero",
}));
vi.mock("../../setup-draft", () => ({
  useSetupDraft: () => ({
    draft: initialDraft(),
    dispatch: () => undefined,
    ready: true,
  }),
}));

const { BarberForm } = await import("./barber-form");
const t = textos.asistente.barbero;

describe("BarberForm", () => {
  it("shows it is saving while the team screen loads", async () => {
    render(<BarberForm hoursSummary="Lun a Sáb" />);
    await userEvent.type(
      screen.getByRole("textbox", { name: new RegExp(t.campos.nombre) }),
      "Mateo",
    );
    await userEvent.click(screen.getByRole("button", { name: t.guardar }));

    const busy = await screen.findByRole("button", { name: t.guardando });
    expect(busy).toBeDisabled();

    await act(async () => gate.release());
  });

  // Task 7.3: Next.js keeps this page mounted, so the form of the next
  // professional came back filled with the one just saved.
  it("starts empty for each new professional", async () => {
    gate.search = "nuevo=1";
    const { rerender } = render(<BarberForm hoursSummary="Lun a Sáb" />);
    const name = () =>
      screen.getByRole("textbox", { name: new RegExp(t.campos.nombre) });
    const email = () =>
      screen.getByRole("textbox", { name: new RegExp(t.campos.correo) });
    await userEvent.type(name(), "Mateo");
    await userEvent.type(email(), "mateo@correo.com");

    // The same page, asked for again by the team screen for the next one.
    gate.search = "nuevo=2abcd";
    rerender(<BarberForm hoursSummary="Lun a Sáb" />);
    expect(name()).toHaveValue("");
    expect(email()).toHaveValue("");
    gate.search = "";
  });
});
