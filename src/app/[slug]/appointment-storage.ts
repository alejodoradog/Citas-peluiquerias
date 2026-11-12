// The appointments this phone booked, with their private links (task 3.4),
// so the customer finds them again from the barbershop's page (C-01) while
// there is no confirmation email. Only in localStorage, never sent anywhere;
// "Borrar mis datos" forgets them too. Storage may be missing or blocked
// (private mode): every access is guarded and the pages work without it.

export type StoredAppointment = {
  token: string;
  slug: string;
  // ISO instant of the start.
  startsAt: string;
  // Cancelled from this phone: no longer shown, but C-16 still knows the
  // barbershop.
  cancelled?: boolean;
};

const KEY = "yapoin:mis-citas";
const MAX = 10;

function readAll(): StoredAppointment[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is StoredAppointment =>
        typeof item === "object" &&
        item !== null &&
        typeof item.token === "string" &&
        typeof item.slug === "string" &&
        typeof item.startsAt === "string" &&
        !Number.isNaN(Date.parse(item.startsAt)),
    );
  } catch {
    return [];
  }
}

function writeAll(items: StoredAppointment[]) {
  try {
    if (items.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage blocked: nothing is remembered.
  }
}

// Only appointments that have not started, the soonest first.
function notStarted(items: StoredAppointment[], now: number) {
  return items
    .filter((item) => Date.parse(item.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export const appointmentStorage = {
  upcoming: (slug: string, now = Date.now()) =>
    notStarted(readAll(), now).filter(
      (item) => item.slug === slug && !item.cancelled,
    ),
  // C-08 and C-09: remember the link, or its new time after a move.
  remember: (item: StoredAppointment, now = Date.now()) =>
    writeAll(
      notStarted(
        [item, ...readAll().filter((other) => other.token !== item.token)],
        now,
      ).slice(0, MAX),
    ),
  // C-16: the barbershop of a link this phone kept, if any.
  slugOf: (token: string) =>
    readAll().find((item) => item.token === token)?.slug ?? null,
  // C-12: cancelled here.
  cancel: (token: string) =>
    writeAll(
      readAll().map((item) =>
        item.token === token ? { ...item, cancelled: true } : item,
      ),
    ),
  // C-16: that link no longer works.
  forget: (token: string) =>
    writeAll(readAll().filter((item) => item.token !== token)),
  clear: () => writeAll([]),
};
