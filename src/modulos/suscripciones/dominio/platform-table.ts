import type { PlatformState } from "./subscription";

// P-01 on a computer (task 7.12): the table of establishments sorts by any
// column. The order lives in the URL (?orden=vence, or ?orden=-vence for the
// other way), so going back keeps it. Without ?orden the list keeps the
// database's order (by name).

export const SORT_KEYS = [
  "nombre",
  "dueno",
  "ciudad",
  "estado",
  "vence",
  "registro",
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export type TableSort = { key: SortKey; descending: boolean };

// The order of the states when the table sorts by "Estado": from the ones
// that need the team first (they will stop taking bookings) to the calm ones.
const STATE_ORDER: readonly PlatformState[] = [
  "expired",
  "grace",
  "suspended",
  "awaiting",
  "expiring",
  "trial",
  "active",
];

export type SortableRow = {
  name: string;
  ownerName: string | null;
  locality: string | null;
  state: PlatformState;
  expiresOn: string;
  createdAt: Date;
};

export function readSort(value: unknown): TableSort | null {
  if (typeof value !== "string") return null;
  const descending = value.startsWith("-");
  const key = descending ? value.slice(1) : value;
  return (SORT_KEYS as readonly string[]).includes(key)
    ? { key: key as SortKey, descending }
    : null;
}

export function sortParam(sort: TableSort): string {
  return sort.descending ? `-${sort.key}` : sort.key;
}

// Tapping a column: the same one turns the order around; another one sorts
// by it from the start.
export function nextSort(current: TableSort | null, key: SortKey): TableSort {
  return current?.key === key
    ? { key, descending: !current.descending }
    : { key, descending: false };
}

const collator = new Intl.Collator("es-CO", { sensitivity: "base" });

// Empty names and places go last whichever way the table is sorted.
function compareText(a: string | null, b: string | null, sign: number) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return collator.compare(a, b) * sign;
}

export function sortRows<T extends SortableRow>(
  rows: readonly T[],
  sort: TableSort | null,
): T[] {
  if (!sort) return [...rows];
  const sign = sort.descending ? -1 : 1;
  const compare = (a: T, b: T): number => {
    switch (sort.key) {
      case "nombre":
        return compareText(a.name, b.name, sign);
      case "dueno":
        return compareText(a.ownerName, b.ownerName, sign);
      case "ciudad":
        return compareText(a.locality, b.locality, sign);
      case "estado":
        return (
          (STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)) * sign
        );
      case "vence":
        return a.expiresOn.localeCompare(b.expiresOn) * sign;
      case "registro":
        return (a.createdAt.getTime() - b.createdAt.getTime()) * sign;
    }
  };
  // Ties keep the name order, so the table never shuffles.
  return [...rows].sort(
    (a, b) => compare(a, b) || compareText(a.name, b.name, 1),
  );
}
