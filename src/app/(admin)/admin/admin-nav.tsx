"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";
import { cx } from "@/ui/cx";
import { BarChartIcon, StoreIcon } from "@/ui/icons";
import { CombMark } from "@/ui/brand-mark";
import { textos } from "@/ui/textos";

const t = textos.plataforma.menu;

const item =
  "flex min-h-11 items-center gap-2.5 rounded-xl px-3 font-semibold no-underline";

// The side menu of the platform panel on a computer (task 7.12), from 1024 px
// wide. On a phone it is hidden and each screen keeps its own header (P-01 to
// P-06). The sign-out sits at its end; the pages hide theirs on a computer.
export function AdminNav({ signOut }: { signOut: React.ReactNode }) {
  const onMetrics = usePathname().startsWith(routes.adminMetrics);
  return (
    <AdminNavShell
      current={onMetrics ? "metricas" : "establecimientos"}
      signOut={signOut}
    />
  );
}

// The same menu without reading the address: what shows while AdminNav
// waits for it (it reads the URL, so it sits inside Suspense).
export function AdminNavShell({
  current,
  signOut,
}: {
  current: "establecimientos" | "metricas" | null;
  signOut: React.ReactNode;
}) {
  const links = [
    {
      href: routes.admin,
      label: t.establecimientos,
      icon: <StoreIcon size={20} />,
      current: current === "establecimientos",
    },
    {
      href: routes.adminMetrics,
      label: t.metricas,
      icon: <BarChartIcon size={20} />,
      current: current === "metricas",
    },
  ];

  return (
    <nav
      aria-label={t.etiqueta}
      className="border-line sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r bg-white px-3.5 py-5 lg:flex"
    >
      <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-4.5">
        <CombMark className="text-brand h-7.5 w-8.5" />
        <span className="flex flex-col">
          <span className="text-lg font-extrabold">{textos.marca}</span>
          <span className="text-muted text-xs">{t.subtitulo}</span>
        </span>
      </div>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.current ? "page" : undefined}
          className={cx(
            item,
            link.current
              ? "bg-brand-soft text-brand-strong font-bold"
              : "text-ink hover:bg-neutral-soft",
          )}
        >
          {link.icon}
          {link.label}
        </Link>
      ))}
      <div className="mt-auto px-1">{signOut}</div>
    </nav>
  );
}
