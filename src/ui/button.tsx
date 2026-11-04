import type { ComponentProps } from "react";

// One look per role, so every screen's buttons and links match.
const variants = {
  primary:
    "bg-brand hover:bg-brand-strong focus-visible:outline-ink flex h-12 w-full items-center justify-center rounded-lg px-5 text-base font-bold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70",
  secondary:
    "border-line text-ink hover:border-ink focus-visible:outline-brand flex h-12 items-center justify-center rounded-lg border-2 px-5 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2",
  compact:
    "text-ink border-line hover:border-ink focus-visible:outline-brand h-10 rounded-lg border-2 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2",
  link: "text-brand-strong focus-visible:outline-brand rounded font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2",
} as const;

export type ButtonVariant = keyof typeof variants;

export function buttonClasses(variant: ButtonVariant): string {
  return variants[variant];
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={[variants[variant], className].filter(Boolean).join(" ")}
    />
  );
}
