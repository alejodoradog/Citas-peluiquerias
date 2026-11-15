import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IDLE } from "@/lib/formularios/form-state";
import { textos } from "@/ui/textos";

const gate = vi.hoisted(() => {
  const state: { release: () => void } = { release: () => undefined };
  return state;
});

// A mark that stays unresolved until the test lets it go.
vi.mock("@/modulos/agenda/acciones/owner-appointment", () => ({
  markAppointment: async () => {
    await new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    return IDLE;
  },
  cancelOwnerAppointment: async () => IDLE,
  changeAppointmentServices: async () => IDLE,
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const { AppointmentActionBar } = await import("./appointment-actions");
const t = textos.agenda;

describe("AppointmentActionBar mark sheet", () => {
  it("locks both choices and says it is saving from the tap", async () => {
    render(
      <AppointmentActionBar
        appointmentId="cita-1"
        customerName="Camila Rojas"
        when="hoy 10:40 a. m."
        actions={{ mark: true, cancel: false } as never}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: t.detalleCita.atendida }),
    );
    const sheet = await screen.findByRole("dialog");
    await userEvent.click(
      within(sheet).getByRole("button", { name: t.detalleCita.noAsistio }),
    );

    expect(
      await within(sheet).findByRole("button", { name: t.marcar.enviando }),
    ).toBeDisabled();
    expect(
      within(sheet).getByRole("button", { name: t.detalleCita.atendida }),
    ).toBeDisabled();

    await act(async () => gate.release());
  });
});
