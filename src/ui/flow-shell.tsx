import type { ReactNode } from "react";
import { ActionBar } from "./action-bar";

// Frame of a flow screen (the setup assistant D-10 to D-14, the "Más"
// screens): its top bar, one narrow column with 14 px between blocks, and
// the main actions in a white bar that stays at the bottom while the content
// scrolls. No brand and no bottom bar: the flow has the whole screen.
export function FlowShell({
  header,
  children,
  actions,
}: {
  header: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-md">{header}</div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-5 pt-1 pb-4">
        {children}
      </main>
      {actions ? (
        <div className="sticky bottom-0 mx-auto w-full max-w-md">
          <ActionBar>{actions}</ActionBar>
        </div>
      ) : null}
    </div>
  );
}
