import type { ReactNode } from "react";
import { cx } from "./cx";

// Base card of F-01: white, Line border, 16 px radius and 16 px padding.
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-card border-line flex flex-col gap-3 border bg-white p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
