import { describe, expect, it } from "vitest";
import { textos } from "@/ui/textos";
import { appointmentErrorMessage } from "./error-messages";

describe("appointmentErrorMessage", () => {
  it("tells the customer the slot is gone, not a technical error", () => {
    expect(appointmentErrorMessage("slot_taken")).toBe(
      textos.agenda.errores.horaTomada,
    );
    expect(textos.agenda.errores.horaTomada).toMatch(/^Esa hora ya la tomaron/);
  });

  it("has a friendly fallback for anything else", () => {
    expect(appointmentErrorMessage("unknown")).toBe(
      textos.agenda.errores.desconocido,
    );
    expect(textos.agenda.errores.desconocido).not.toBe("");
  });
});
