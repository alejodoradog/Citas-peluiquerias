import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/modulos/cuentas/acciones/auth";
import { textos } from "./textos";

// Frame for signed-in screens: the comb mark, the brand and sign out.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="comb" aria-hidden="true" />
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-5 pt-6">
        <Link
          href="/"
          className="text-brand-strong focus-visible:outline-brand rounded text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {textos.cuentas.marca}
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="text-ink border-line hover:border-ink focus-visible:outline-brand h-10 rounded-lg border-2 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {textos.cuentas.salir}
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-10 pb-16">
        {children}
      </main>
    </div>
  );
}
