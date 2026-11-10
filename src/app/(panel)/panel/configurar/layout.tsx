import type { ReactNode } from "react";
import { SetupDraftProvider } from "./setup-draft";

// The draft survives moving between the steps of the wizard: this layout does
// not unmount while the owner goes from D-10 to D-13.
export default function SetupLayout({ children }: { children: ReactNode }) {
  return <SetupDraftProvider>{children}</SetupDraftProvider>;
}
