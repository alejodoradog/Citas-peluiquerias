import type { ReactNode } from "react";
import { cx } from "./cx";

export type ChipTone = "brand" | "success" | "warning" | "danger" | "neutral";

const tones: Record<ChipTone, string> = {
  brand: "bg-brand-soft text-brand-strong",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-muted",
};

// Status chip of F-01 (appointment and barbershop states). It only shows a
// state; it is never a control.
export function Chip({
  tone,
  children,
}: {
  tone: ChipTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "text-chip inline-flex h-6 items-center rounded-full px-2.5 whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
