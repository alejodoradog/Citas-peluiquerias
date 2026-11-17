import { describe, expect, it } from "vitest";
import { originLabel } from "./labels";

// Task 7.7: D-34 says who made a walk-in, from its "created" event.
describe("originLabel", () => {
  it("names the professional who made the walk-in", () => {
    expect(originLabel("walk_in", { by: "professional", name: "Ana" })).toBe(
      "Creada al momento por Ana",
    );
  });
  it("or the establishment", () => {
    expect(originLabel("walk_in", { by: "barbershop" })).toBe(
      "Creada al momento por el establecimiento",
    );
  });
  it("a walk-in without its event, and the other origins, say their origin", () => {
    expect(originLabel("walk_in", null)).toBe("Cita al momento, sin reserva");
    expect(originLabel("web", null)).toBe("Reservada por la web");
    expect(originLabel("manual", null)).toBe("Creada por el establecimiento");
  });
});
