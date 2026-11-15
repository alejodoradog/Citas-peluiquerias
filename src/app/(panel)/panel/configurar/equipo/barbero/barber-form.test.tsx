import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startTransition } from "react";
import { describe, expect, it, vi } from "vitest";
import { initialDraft } from "@/modulos/barberias/dominio/setup";
import { textos } from "@/ui/textos";

const gate = vi.hoisted(() => {
  const state: { release: () => void } = { release: () => undefined };
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
  useSearchParams: () => new URLSearchParams(),
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
});
