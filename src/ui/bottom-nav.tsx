"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { routes } from "@/lib/routes";
import { cx } from "./cx";
import { CalendarIcon, MenuIcon, ShareIcon, UsersIcon } from "./icons";
import { textos } from "./textos";

const t = textos.ui.navegacion;

const items: ReadonlyArray<{ href: string; label: string; icon: ReactNode }> = [
  { href: routes.panel, label: t.agenda, icon: <CalendarIcon size={22} /> },
  {
    href: routes.panelClients,
    label: t.clientes,
    icon: <UsersIcon size={22} />,
  },
  {
    href: routes.panelShare,
    label: t.compartir,
    icon: <ShareIcon size={22} />,
  },
  { href: routes.panelMore, label: t.mas, icon: <MenuIcon size={22} /> },
];

// The agenda is the panel's home, so it is active only on its own page; the
// other sections stay active on their sub-pages.
export function isActive(href: string, pathname: string): boolean {
  if (href === routes.panel) return pathname === routes.panel;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Bottom bar of the owner's panel (F-01, D-30). A client component so the
// active tab follows every navigation without re-rendering the layout.
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={t.etiqueta}
      className="border-line fixed inset-x-0 bottom-0 border-t bg-white"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 px-2 pt-0.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-13 flex-col items-center gap-0.75 py-2 text-xs no-underline",
                  active
                    ? "text-brand-strong font-bold"
                    : "text-muted font-medium",
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
