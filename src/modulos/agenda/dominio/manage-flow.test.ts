import { describe, expect, it } from "vitest";
import { manageQuery, readManageParams } from "./manage-flow";

describe("readManageParams", () => {
  it("shows the appointment by default", () => {
    expect(readManageParams({})).toEqual({
      step: "cita",
      date: null,
      time: null,
      changed: false,
      taken: null,
    });
  });

  it("reads the day and the time of C-10", () => {
    expect(
      readManageParams({ paso: "cambiar", dia: "2026-11-24", hora: "16:45" }),
    ).toMatchObject({ step: "cambiar", date: "2026-11-24", time: "16:45" });
  });

  it("drops a time without a day, off the quarter hours or repeated", () => {
    expect(readManageParams({ paso: "cambiar", hora: "16:45" }).time).toBe(
      null,
    );
    expect(
      readManageParams({ paso: "cambiar", dia: "2026-11-24", hora: "16:40" })
        .time,
    ).toBe(null);
    expect(
      readManageParams({
        paso: "cambiar",
        dia: "2026-11-24",
        hora: ["10:00", "11:00"],
      }).time,
    ).toBe(null);
    expect(readManageParams({ paso: "cambiar", dia: "2026-02-30" }).date).toBe(
      null,
    );
  });

  it("keeps each notice on its own screen", () => {
    expect(readManageParams({ cambiada: "1" }).changed).toBe(true);
    expect(readManageParams({ paso: "cambiar", cambiada: "1" }).changed).toBe(
      false,
    );
    expect(readManageParams({ paso: "cambiar", tomada: "10:00" }).taken).toBe(
      "10:00",
    );
    expect(readManageParams({ tomada: "10:00" }).taken).toBe(null);
  });

  it("ignores any other step", () => {
    expect(readManageParams({ paso: "cancelar" }).step).toBe("cita");
  });
});

describe("manageQuery", () => {
  it("writes only what is set", () => {
    expect(manageQuery({})).toBe("");
    expect(manageQuery({ changed: true })).toBe("?cambiada=1");
    expect(
      manageQuery({ step: "cambiar", date: "2026-11-24", time: "16:45" }),
    ).toBe("?paso=cambiar&dia=2026-11-24&hora=16%3A45");
  });

  it("reads back what it writes", () => {
    const selection = {
      step: "cambiar" as const,
      date: "2026-11-24",
      time: "09:15",
      taken: "10:00",
    };
    const params = Object.fromEntries(
      new URLSearchParams(manageQuery(selection)),
    );
    expect(readManageParams(params)).toEqual({ ...selection, changed: false });
  });
});
