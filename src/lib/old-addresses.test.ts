import { describe, expect, it } from "vitest";
import { movedAddress } from "./old-addresses";

const ID = "ba000000-0000-4000-8000-000000000001";

describe("movedAddress", () => {
  it("sends the team's old address to Profesionales (task 7.1b)", () => {
    expect(movedAddress("/panel/barberos")).toBe("/panel/profesionales");
    expect(movedAddress(`/panel/barberos/${ID}/horario`)).toBe(
      `/panel/profesionales/${ID}/horario`,
    );
  });

  it("sends the old 'Link privado' of a professional to their card (task 7.6c)", () => {
    expect(movedAddress(`/panel/profesionales/${ID}/link`)).toBe(
      `/panel/profesionales/${ID}`,
    );
    expect(movedAddress(`/panel/barberos/${ID}/link/`)).toBe(
      `/panel/profesionales/${ID}`,
    );
  });

  it("leaves everything else where it is", () => {
    for (const path of [
      "/panel/profesionales",
      `/panel/profesionales/${ID}`,
      `/panel/profesionales/${ID}/horario`,
      "/panel/link",
      `/panel/profesionales/${ID}/link/otra`,
    ]) {
      expect(movedAddress(path)).toBeNull();
    }
  });
});
