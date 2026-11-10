import { describe, expect, it } from "vitest";
import { MAX_WEEK_LENGTH, echoWeek, readWeek } from "./week-field";

describe("week field", () => {
  it("reads the JSON a screen sends", () => {
    expect(readWeek('[{"weekday":1}]')).toEqual([{ weekday: 1 }]);
    expect(readWeek("not json")).toBeNull();
    expect(readWeek("x".repeat(MAX_WEEK_LENGTH + 1))).toBeNull();
  });

  it("echoes back only what a screen could have sent", () => {
    expect(echoWeek("[]")).toBe("[]");
    expect(echoWeek("x".repeat(MAX_WEEK_LENGTH))).toHaveLength(
      MAX_WEEK_LENGTH,
    );
    expect(echoWeek("x".repeat(MAX_WEEK_LENGTH + 1))).toBe("");
    expect(echoWeek(null)).toBe("");
    expect(echoWeek(new File(["[]"], "week.json"))).toBe("");
  });
});
