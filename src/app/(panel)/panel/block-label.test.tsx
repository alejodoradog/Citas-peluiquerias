import { describe, expect, it } from "vitest";
import { textos } from "@/ui/textos";
import { blockLabel } from "./day-grid";

const t = textos.agenda;
const block = (reason: string | null, wholeShop: boolean) => ({
  kind: "block" as const,
  id: "b",
  start: new Date("2027-03-01T15:00:00Z"),
  end: new Date("2027-03-01T16:00:00Z"),
  reason,
  wholeShop,
});

// Task 8.14: in the owner's agenda a closure of the whole establishment
// never reads like a block of their own agenda.
describe("blockLabel", () => {
  it("names a block of one professional by its reason, or Bloqueado", () => {
    expect(blockLabel(block("Diligencia", false))).toBe("Diligencia");
    expect(blockLabel(block(null, false))).toBe(t.bloqueo);
  });

  it("says Cerrado for a closure of the whole establishment, also with a reason", () => {
    expect(blockLabel(block(null, true))).toBe(t.cierre);
    expect(blockLabel(block("Diligencia", true))).toBe(
      t.cierreCon("Diligencia"),
    );
  });
});
