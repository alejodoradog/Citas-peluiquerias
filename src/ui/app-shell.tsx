import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { BrandHeader } from "./brand";
import { cx } from "./cx";
import { SignOutButton } from "./sign-out-button";

// Frame of signed-in screens: the brand, sign out and, in the owner's panel,
// the bottom bar (F-01). The page leaves room under its content for the bar.
export function AppShell({
  children,
  bottomNav = false,
}: {
  children: ReactNode;
  bottomNav?: boolean;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4 px-5 pt-7">
        <BrandHeader />
        <SignOutButton />
      </header>
      <main
        className={cx(
          "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5.5 px-5 pt-7",
          bottomNav ? "pb-28" : "pb-16",
        )}
      >
        {children}
      </main>
      {bottomNav ? <BottomNav /> : null}
    </div>
  );
}
