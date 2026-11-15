import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { textos } from "@/ui/textos";

const gate = vi.hoisted(() => {
  const state: { release: () => void } = { release: () => undefined };
  return state;
});

// A save that stays unresolved until the test lets it go.
vi.mock("@/modulos/cierre/acciones/day-close", () => ({
  setCommission: async () => {
    await new Promise<void>((resolve) => {
      gate.release = resolve;
    });
  },
}));

const { CommissionForm } = await import("./commission-form");

describe("CommissionForm", () => {
  it("locks the select and announces the save while it runs", async () => {
    render(<CommissionForm date="2026-11-15" percent={40} />);
    const select = screen.getByRole("combobox", {
      name: textos.cierre.comision,
    });
    await userEvent.selectOptions(select, "50");

    expect(await screen.findByRole("status")).toHaveTextContent(
      textos.cierre.guardando,
    );
    expect(select).toBeDisabled();

    await act(async () => gate.release());
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
