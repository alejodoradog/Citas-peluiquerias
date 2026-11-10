import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";

// Frame of a section of the bottom bar that has its own top bar (D-50 Más,
// D-62 Compartir): the section's name as the screen's heading, a line under
// it, no way back, and room under the content for the bar. Agenda and
// Clientes keep the AppShell until tasks 4.1 and 4.3.
export function TabShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-md">
        <TopBar title={title} subtitle={subtitle} titleAs="h1" />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-5 pt-1 pb-28">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
