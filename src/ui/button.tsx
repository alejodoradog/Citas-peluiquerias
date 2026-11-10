import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "./cx";

// The five buttons of F-01. Every size reaches 44 px, the smallest touch the
// design allows.
const variants = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "border border-line bg-white text-ink hover:border-ink",
  danger: "border border-danger bg-white text-danger hover:bg-danger-soft",
  dangerSolid: "bg-danger text-white hover:bg-ink",
  text: "bg-transparent text-brand-strong hover:text-ink",
} as const;

const sizes = {
  lg: "min-h-13.5 text-button",
  md: "min-h-11.5 text-body font-bold",
  sm: "min-h-11 text-label font-bold",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export type ButtonStyle = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Full width, as most buttons of the design. Off for buttons in a row.
  block?: boolean;
};

export function buttonClasses({
  variant = "primary",
  size = "lg",
  block = true,
}: ButtonStyle = {}): string {
  return cx(
    "rounded-button inline-flex items-center justify-center gap-2 px-4.5 text-center no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-70",
    variants[variant],
    sizes[size],
    block && "w-full",
  );
}

export function Button({
  variant,
  size,
  block,
  className,
  ...props
}: ComponentProps<"button"> & ButtonStyle) {
  return (
    <button
      type="button"
      {...props}
      className={cx(buttonClasses({ variant, size, block }), className)}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return (
    <Link
      {...props}
      className={cx(buttonClasses({ variant, size, block }), className)}
    />
  );
}
