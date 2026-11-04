import Link from "next/link";
import type { ReactNode } from "react";
import { routes } from "@/lib/routes";
import { buttonClasses } from "./button";
import { textos } from "./textos";

// Frame for the account screens: the comb mark, the brand and one narrow,
// left-aligned column that reads well on a phone.
export function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="comb" aria-hidden="true" />
      <header className="mx-auto w-full max-w-md px-5 pt-6">
        <Link
          href={routes.home}
          className="text-brand-strong focus-visible:outline-brand rounded text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {textos.cuentas.marca}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pt-10 pb-16">
        <h1 className="text-[2rem] leading-[1.1] font-extrabold tracking-tight text-balance">
          {title}
        </h1>
        {intro ? (
          <p className="text-muted mt-3 text-base leading-relaxed">{intro}</p>
        ) : null}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses("link")}>
      {children}
    </Link>
  );
}
