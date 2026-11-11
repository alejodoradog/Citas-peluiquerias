"use client";

import { useEffect, useReducer } from "react";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";

// Task 2.6b: after "Eliminar sede" the panel loads in full on the agenda,
// which says which sede was deleted. The name travels in sessionStorage, not
// in the URL: a link someone sends can never make the panel claim a deletion
// that did not happen. It is shown once.
const DELETED_KEY = "yapoin:sede-eliminada";

export function rememberDeletedBarbershop(name: string) {
  try {
    window.sessionStorage.setItem(DELETED_KEY, name);
  } catch {
    // Storage can be blocked; the agenda simply does not say it.
  }
}

function takeDeletedBarbershop(): string | null {
  try {
    const name = window.sessionStorage.getItem(DELETED_KEY);
    window.sessionStorage.removeItem(DELETED_KEY);
    return name;
  } catch {
    return null;
  }
}

function reducer(_state: string | null, name: string | null) {
  return name;
}

export function DeletedBarbershopNotice() {
  const [name, show] = useReducer(reducer, null);
  // After mounting, so the server and the first render match. The name is
  // taken once: a second run of this effect (React's Strict Mode runs it
  // twice in development) finds nothing and must not hide it again.
  useEffect(() => {
    const deleted = takeDeletedBarbershop();
    if (deleted) show(deleted);
  }, []);
  if (!name) return null;
  return <Notice tone="success" title={textos.sedes.eliminada(name)} />;
}
