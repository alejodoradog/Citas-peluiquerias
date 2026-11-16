import { describe, expect, it } from "vitest";
import {
  nextSort,
  readSort,
  sortParam,
  sortRows,
  type SortableRow,
} from "./platform-table";

const row = (over: Partial<SortableRow> & { name: string }): SortableRow => ({
  ownerName: null,
  locality: null,
  state: "active",
  expiresOn: "2026-12-01",
  createdAt: new Date("2026-10-01T15:00:00Z"),
  ...over,
});

const names = (rows: SortableRow[]) => rows.map((r) => r.name);

describe("readSort", () => {
  it("reads a column and its direction", () => {
    expect(readSort("vence")).toEqual({ key: "vence", descending: false });
    expect(readSort("-registro")).toEqual({
      key: "registro",
      descending: true,
    });
  });

  it("drops anything else", () => {
    expect(readSort(undefined)).toBeNull();
    expect(readSort("precio")).toBeNull();
    expect(readSort("--vence")).toBeNull();
    expect(readSort(["vence"])).toBeNull();
  });

  it("writes back what it reads", () => {
    for (const value of ["nombre", "-dueno", "estado", "-vence"]) {
      expect(sortParam(readSort(value)!)).toBe(value);
    }
  });
});

describe("nextSort", () => {
  it("turns the same column around and starts another one ascending", () => {
    expect(nextSort(null, "vence")).toEqual({
      key: "vence",
      descending: false,
    });
    expect(nextSort({ key: "vence", descending: false }, "vence")).toEqual({
      key: "vence",
      descending: true,
    });
    expect(nextSort({ key: "vence", descending: true }, "nombre")).toEqual({
      key: "nombre",
      descending: false,
    });
  });
});

describe("sortRows", () => {
  const rows = [
    row({
      name: "Spa Luna",
      ownerName: "Daniela",
      locality: "Medellín",
      state: "trial",
      expiresOn: "2026-12-09",
      createdAt: new Date("2026-11-09T15:00:00Z"),
    }),
    row({
      name: "Ácido Barber",
      ownerName: null,
      locality: null,
      state: "expired",
      expiresOn: "2026-11-05",
      createdAt: new Date("2026-10-05T15:00:00Z"),
    }),
    row({
      name: "barbería centro",
      ownerName: "Carlos",
      locality: "Bogotá",
      state: "grace",
      expiresOn: "2026-11-13",
      createdAt: new Date("2026-10-14T15:00:00Z"),
    }),
  ];

  it("keeps the order it got without a sort", () => {
    expect(names(sortRows(rows, null))).toEqual(names(rows));
  });

  it("sorts names as Spanish, without minding accents or capitals", () => {
    expect(names(sortRows(rows, { key: "nombre", descending: false }))).toEqual(
      ["Ácido Barber", "barbería centro", "Spa Luna"],
    );
    expect(names(sortRows(rows, { key: "nombre", descending: true }))).toEqual([
      "Spa Luna",
      "barbería centro",
      "Ácido Barber",
    ]);
  });

  it("leaves an empty owner or place last both ways", () => {
    expect(
      names(sortRows(rows, { key: "dueno", descending: false })).at(-1),
    ).toBe("Ácido Barber");
    expect(
      names(sortRows(rows, { key: "ciudad", descending: true })).at(-1),
    ).toBe("Ácido Barber");
  });

  it("puts the states that need the team first", () => {
    expect(names(sortRows(rows, { key: "estado", descending: false }))).toEqual(
      ["Ácido Barber", "barbería centro", "Spa Luna"],
    );
  });

  it("sorts by the day it ends and the day it signed up", () => {
    expect(names(sortRows(rows, { key: "vence", descending: false }))).toEqual([
      "Ácido Barber",
      "barbería centro",
      "Spa Luna",
    ]);
    expect(
      names(sortRows(rows, { key: "registro", descending: true })),
    ).toEqual(["Spa Luna", "barbería centro", "Ácido Barber"]);
  });

  it("breaks ties by name and never changes the list it got", () => {
    const tied = [row({ name: "Zeta" }), row({ name: "Alfa" })];
    expect(names(sortRows(tied, { key: "vence", descending: true }))).toEqual([
      "Alfa",
      "Zeta",
    ]);
    expect(names(tied)).toEqual(["Zeta", "Alfa"]);
  });
});
