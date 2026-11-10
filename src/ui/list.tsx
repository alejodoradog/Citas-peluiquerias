import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { ChevronRightIcon } from "./icons";

// List of F-01: rows inside a card, split by a soft line. A row with href is
// one link (title, detail and trailing value read as its name) with a chevron.
export function List({ children }: { children: ReactNode }) {
  return (
    <ul className="rounded-card border-line flex flex-col overflow-hidden border bg-white">
      {children}
    </ul>
  );
}

export function ListRow({
  title,
  subtitle,
  trailing,
  icon,
  href,
  badge,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  // Shown right after the title, as the "Tú" chip of the owner (D-12, D-53).
  badge?: ReactNode;
  icon?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      {icon ? <span className="text-ink flex">{icon}</span> : null}
      {/* The spaces keep the link's name readable ("Corte 40 min $25.000");
          flex layout hides them on screen. */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cx(
            "text-body font-semibold",
            badge != null && "flex flex-wrap items-center gap-x-2 gap-y-0.5",
          )}
        >
          {title}
          {badge != null ? <> {badge}</> : null}
        </span>{" "}
        {subtitle ? (
          <span className="text-help text-muted leading-[1.35]">
            {subtitle}
          </span>
        ) : null}
      </span>{" "}
      {trailing}
      {href ? (
        <span className="text-muted flex">
          <ChevronRightIcon size={18} />
        </span>
      ) : null}
    </>
  );
  const row = "flex min-h-13 items-center gap-3 px-4 py-3.5";

  return (
    <li className="border-neutral-soft border-b last:border-b-0">
      {href ? (
        <Link
          href={href}
          className={`${row} text-ink focus-visible:-outline-offset-2`}
        >
          {content}
        </Link>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  );
}
