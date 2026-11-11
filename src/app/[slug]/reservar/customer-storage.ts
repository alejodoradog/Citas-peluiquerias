// The customer's details on this phone only (C-06: "autocompletar solo
// desde el navegador"). The server never returns a customer's details for
// what someone types. Two keys:
// - DRAFT (sessionStorage): what was typed when "Confirmar reserva" was
//   pressed, so C-07 can say "Tus datos quedan guardados";
// - SAVED (localStorage): written only on C-08, once the booking is made.
// Storage may be missing or blocked (private mode): every access is guarded
// and the page works without it.

export type StoredCustomer = { name: string; email: string; phone: string };

const DRAFT = "yapoin:reserva-borrador";
const SAVED = "yapoin:mis-datos";

function read(storage: () => Storage, key: string): StoredCustomer | null {
  try {
    const raw = storage().getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as StoredCustomer).name === "string" &&
      typeof (value as StoredCustomer).email === "string" &&
      typeof (value as StoredCustomer).phone === "string"
    ) {
      const { name, email, phone } = value as StoredCustomer;
      return { name, email, phone };
    }
    return null;
  } catch {
    return null;
  }
}

function write(
  storage: () => Storage,
  key: string,
  value: StoredCustomer | null,
) {
  try {
    if (value) storage().setItem(key, JSON.stringify(value));
    else storage().removeItem(key);
  } catch {
    // Storage blocked: nothing is remembered.
  }
}

const session = () => window.sessionStorage;
const local = () => window.localStorage;

export const customerStorage = {
  draft: () => read(session, DRAFT),
  saveDraft: (value: StoredCustomer) => write(session, DRAFT, value),
  saved: () => read(local, SAVED),
  forget: () => {
    write(local, SAVED, null);
    write(session, DRAFT, null);
  },
  // C-08: the booking was made, so the draft becomes the saved details.
  keepDraft: (): StoredCustomer | null => {
    const draft = read(session, DRAFT);
    if (draft) {
      write(local, SAVED, draft);
      write(session, DRAFT, null);
    }
    return draft ?? read(local, SAVED);
  },
};
