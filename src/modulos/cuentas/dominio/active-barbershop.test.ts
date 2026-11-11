import { describe, expect, it } from "vitest";
import { pickActiveBarbershop, sortByCreation } from "./active-barbershop";

const first = { id: "bbbb", createdAt: "2026-11-01T10:00:00+00:00" };
const second = { id: "aaaa", createdAt: "2026-11-05T10:00:00+00:00" };
const twin = { id: "cccc", createdAt: "2026-11-05T10:00:00+00:00" };

describe("sortByCreation", () => {
  it("puts the oldest barbershop first and breaks ties by id", () => {
    expect(sortByCreation([twin, second, first])).toEqual([
      first,
      second,
      twin,
    ]);
  });

  it("does not reorder the list it was given", () => {
    const list = [second, first];
    sortByCreation(list);
    expect(list).toEqual([second, first]);
  });
});

describe("pickActiveBarbershop", () => {
  const owned = [first, second];

  it("takes the barbershop the cookie names when it is the owner's", () => {
    expect(pickActiveBarbershop(owned, "aaaa")).toBe(second);
  });

  it("ignores a barbershop that is not the owner's", () => {
    expect(pickActiveBarbershop(owned, "dddd")).toBe(first);
  });

  it("takes the oldest one without a cookie", () => {
    expect(pickActiveBarbershop(owned, undefined)).toBe(first);
    expect(pickActiveBarbershop(owned, "")).toBe(first);
  });

  it("has nothing to pick without barbershops", () => {
    expect(pickActiveBarbershop([], "aaaa")).toBeUndefined();
  });
});
