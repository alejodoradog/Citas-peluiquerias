import type { ReactNode } from "react";

// White bar at the bottom of a screen that holds its main actions (D-01).
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="border-line mt-auto flex flex-col gap-2.5 border-t bg-white px-5 pt-3.5 pb-5.5">
      {children}
    </div>
  );
}
