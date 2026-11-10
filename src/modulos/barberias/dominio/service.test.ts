import { describe, expect, it } from "vitest";
import { isId, parseIdList, splitServices } from "./service";

const A = "3f1c2b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f";
const B = "00000000-0000-0000-0000-000000000002";

describe("isId", () => {
  it("accepts database ids, seeded ones included", () => {
    expect(isId(A)).toBe(true);
    expect(isId(B)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of ["", "nuevo", "123", `${A}x`, null, 7]) {
      expect(isId(value)).toBe(false);
    }
  });
});

describe("parseIdList", () => {
  it("keeps the ids once, in the order they came", () => {
    expect(parseIdList([B, A, B, A.toUpperCase()])).toEqual([B, A]);
  });

  it("accepts an empty list: nobody does the service yet", () => {
    expect(parseIdList([])).toEqual([]);
  });

  it("rejects the whole list when one value is not an id", () => {
    expect(parseIdList([A, "otro"])).toBeNull();
    expect(parseIdList([A, new Blob()])).toBeNull();
  });
});

describe("splitServices", () => {
  const service = (name: string, active = true) => ({ name, active });

  it("puts the active services first and the inactive ones apart", () => {
    const { active, inactive } = splitServices([
      service("Mascarilla", false),
      service("Corte"),
      service("Barba"),
    ]);
    expect(active.map((s) => s.name)).toEqual(["Barba", "Corte"]);
    expect(inactive.map((s) => s.name)).toEqual(["Mascarilla"]);
  });

  it("orders names as people read them, accents and case aside", () => {
    const { active } = splitServices([
      service("cejas"),
      service("Corte"),
      service("Árbol"),
      service("Barba"),
    ]);
    expect(active.map((s) => s.name)).toEqual([
      "Árbol",
      "Barba",
      "cejas",
      "Corte",
    ]);
  });

  it("does not change the list it receives", () => {
    const list = [service("Corte"), service("Barba")];
    splitServices(list);
    expect(list.map((s) => s.name)).toEqual(["Corte", "Barba"]);
  });
});
