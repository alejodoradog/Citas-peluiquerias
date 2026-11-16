import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { cx } from "./cx";

// A link in the brand's strong color. Inside a sentence it flows with the
// text; standalone it is a centered, 44 px tall target of its own.
export function TextLink({
  href,
  children,
  standalone = false,
  onClick,
}: {
  href: string;
  children: ReactNode;
  standalone?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cx(
        "text-brand-strong hover:text-ink font-bold underline underline-offset-2",
        standalone &&
          "text-body inline-flex min-h-11 w-full items-center justify-center",
      )}
    >
      {children}
    </Link>
  );
}
