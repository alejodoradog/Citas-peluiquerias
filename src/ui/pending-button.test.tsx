import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PendingButton } from "./pending-button";

// A Server Action that stays unresolved until the test lets it go.
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("PendingButton", () => {
  it("disables itself and shows the pending text while the action runs", async () => {
    const gate = deferred();
    let sent = 0;
    const action = async () => {
      sent += 1;
      await gate.promise;
    };
    render(
      <form action={action}>
        <PendingButton pendingText="Guardando…">Guardar</PendingButton>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    const busy = await screen.findByRole("button", { name: "Guardando…" });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(sent).toBe(1);

    await act(async () => gate.release());
    expect(
      await screen.findByRole("button", { name: "Guardar" }),
    ).toBeEnabled();
  });

  it("swaps the text only on the pressed choice and locks both", async () => {
    const gate = deferred();
    const action = async () => {
      await gate.promise;
    };
    render(
      <form action={action}>
        <PendingButton name="estado" value="a" pendingText="Guardando…">
          Atendida
        </PendingButton>
        <PendingButton name="estado" value="b" pendingText="Guardando…">
          No asistió
        </PendingButton>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "No asistió" }));

    expect(
      await screen.findByRole("button", { name: "Guardando…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Atendida" })).toBeDisabled();

    await act(async () => gate.release());
  });
});
