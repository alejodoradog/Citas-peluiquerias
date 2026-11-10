import type { ReactNode } from "react";
import { BrandHeader } from "./brand";

// Frame of the account screens (D-02 to D-09): the brand on top and one
// narrow column, with 22 px between blocks, that reads well on a phone.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5.5 px-5 pt-7 pb-7.5">
      <BrandHeader />
      {children}
    </main>
  );
}

// Heading of an account screen: optional icon, the title and one line of
// intro. Forms that switch to a "done" view render their own, so the whole
// screen changes, as in D-03 and D-08.
export function AuthHeading({
  title,
  intro,
  icon,
}: {
  title: string;
  intro?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <>
      {icon ? <span className="text-brand flex">{icon}</span> : null}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title text-balance">{title}</h1>
        {intro ? <p className="text-body text-muted">{intro}</p> : null}
      </div>
    </>
  );
}
