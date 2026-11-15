import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { textos } from "./textos";

const gate = vi.hoisted(() => {
  const state: { release: () => void; calls: number } = {
    release: () => undefined,
    calls: 0,
  };
  return state;
});

// A sign out that stays unresolved until the test lets it go.
vi.mock("@/modulos/cuentas/acciones/account", () => ({
  signOut: async () => {
    gate.calls += 1;
    await new Promise<void>((resolve) => {
      gate.release = resolve;
    });
  },
}));

const { SignOutButton } = await import("./sign-out-button");

describe("SignOutButton", () => {
  it.each([false, true])(
    "locks and says it is working from the tap (row: %s)",
    async (row) => {
      gate.calls = 0;
      render(<SignOutButton row={row} />);
      await userEvent.click(
        screen.getByRole("button", { name: textos.cuentas.salir }),
      );

      const busy = await screen.findByRole("button", {
        name: textos.cuentas.saliendo,
      });
      expect(busy).toBeDisabled();
      await userEvent.click(busy);
      expect(gate.calls).toBe(1);

      await act(async () => gate.release());
    },
  );
});
