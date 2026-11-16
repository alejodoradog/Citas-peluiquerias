import { describe, expect, it } from "vitest";
import { hasTrial, paramOf, planFromParam, SIGNUP_PLANS } from "./plans";

describe("planFromParam", () => {
  it("reads the plan of a link", () => {
    expect(planFromParam("1")).toBe("standard");
    expect(planFromParam("2")).toBe("plus");
  });

  it("is plan 1 for anything else", () => {
    for (const value of [
      undefined,
      "",
      "3",
      "plus",
      "por_acuerdo",
      ["2"],
      "constructor",
      "__proto__",
      "toString",
    ]) {
      expect(planFromParam(value)).toBe("standard");
    }
  });

  it("writes back what it reads", () => {
    for (const plan of SIGNUP_PLANS) {
      expect(planFromParam(paramOf(plan))).toBe(plan);
    }
  });
});

describe("hasTrial", () => {
  it("is only plan 1's", () => {
    expect(hasTrial("standard")).toBe(true);
    expect(hasTrial("plus")).toBe(false);
    expect(hasTrial("por_acuerdo")).toBe(false);
  });
});
