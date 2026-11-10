import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

// A link in the brand's strong color. Inside a sentence it flows with the
// text; standalone it is a centered, 44 px tall target of its own.
export function TextLink({
  href,
  children,
  standalone = false,
}: {
  href: string;
  children: ReactNode;
  standalone?: boolean;
}) {
  return (
    <Link
      href={href}
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
