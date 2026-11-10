import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon, CloseIcon } from "./icons";

type TopBarLink = { href: string; label: string };

const iconLink =
  "flex size-11 shrink-0 items-center justify-center rounded-full no-underline";

// Top bar of the setup flow and the "Más" screens (D-10 to D-13, D-51 to
// D-55, D-62): back or close on the left, a 16/700 title with an optional
// 12 px line under it, and an optional action on the right. Without a link
// on the left, an 8 px spacer lines the title up with the content.
export function TopBar({
  title,
  subtitle,
  back,
  close,
  action,
  titleAs: Title = "p",
}: {
  title: string;
  subtitle?: string;
  back?: TopBarLink;
  close?: TopBarLink;
  action?: ReactNode;
  // "h1" when the bar's title is the only heading of the screen (D-51).
  titleAs?: "p" | "h1";
}) {
  const leading = back ?? close;
  return (
    <header className="flex min-h-14 items-center gap-1 px-3 pt-2.5 pb-1.5">
      {leading ? (
        <Link
          href={leading.href}
          aria-label={leading.label}
          className={`${iconLink} text-ink`}
        >
          {back ? <ChevronLeftIcon size={22} /> : <CloseIcon size={22} />}
        </Link>
      ) : (
        <div className="w-2 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Title className="text-base font-bold">{title}</Title>
        {subtitle ? <p className="text-muted text-xs">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

// An icon action for the right of the top bar ("Agregar servicio", D-51),
// 44 × 44 and named by its label.
export function TopBarAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${iconLink} text-brand-strong hover:text-ink`}
    >
      {icon}
    </Link>
  );
}
