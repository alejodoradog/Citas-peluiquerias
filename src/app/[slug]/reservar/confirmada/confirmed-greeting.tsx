"use client";

import { useEffect, useState } from "react";
import { textos } from "@/ui/textos";
import { customerStorage } from "../customer-storage";

// "¡Listo, Camila!" of C-08. The booking was made, so what the customer
// typed is now kept on this phone (and only here) for the next booking.
export function ConfirmedGreeting() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const kept = customerStorage.keepDraft();
    const first = kept?.name.trim().split(/\s+/)[0] ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser storage after mounting
    setName(first || null);
  }, []);
  return (
    <h1 className="text-title">{textos.reservas.confirmada.titulo(name)}</h1>
  );
}
