"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";

// Next.js keeps a page it leaves mounted but hidden (React's Activity) and
// shows that same instance when the person comes back, with whatever draft
// it had. Editors of saved data must start again from what is saved: hiding
// runs this effect's cleanup, which gives the children a new key, so they
// mount afresh (state, form errors and all) before they show again. A real
// unmount runs it too, harmlessly.
export function FreshOnReturn({ children }: { children: ReactNode }) {
  const [round, setRound] = useState(0);
  useEffect(() => () => setRound((current) => current + 1), []);
  return <Fragment key={round}>{children}</Fragment>;
}
