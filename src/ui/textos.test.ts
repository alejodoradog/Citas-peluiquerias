import { describe, expect, it } from "vitest";
import { textos } from "./textos";

describe("textos", () => {
  it("defines the home page copy", () => {
    expect(textos.inicio.titulo).not.toBe("");
    expect(textos.inicio.descripcion).not.toBe("");
  });
});
