"use client";

import { useEffect } from "react";
import { clearStoredDraft } from "../setup-draft";

// The wizard is saved: its draft is not needed on this device anymore.
export function ClearSetupDraft() {
  useEffect(() => {
    clearStoredDraft();
  }, []);
  return null;
}
