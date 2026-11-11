"use client";

import { useEffect } from "react";
import { clearStoredDraft } from "../setup-draft";

// The wizard of this sede is saved: its draft is not needed on this device
// anymore.
export function ClearSetupDraft({ barbershopId }: { barbershopId: string }) {
  useEffect(() => {
    clearStoredDraft(barbershopId);
  }, [barbershopId]);
  return null;
}
