import { describe, expect, it } from "vitest";
import { yapoinWhatsapp } from "./whatsapp";

describe("yapoinWhatsapp", () => {
  it("opens Yapoin's chat with the message written", () => {
    expect(yapoinWhatsapp("Hola, ¿cómo así?")).toBe(
      "https://wa.me/573229381101?text=Hola%2C%20%C2%BFc%C3%B3mo%20as%C3%AD%3F",
    );
  });
});
