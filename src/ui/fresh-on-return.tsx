"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

// Next.js keeps a page it leaves mounted but hidden (React's Activity) and
// shows that same instance when the person comes back, with whatever draft
// it had. Editors of saved data must start again from what is saved: hiding
// runs this effect's cleanup, which gives the children a new key, so they
// mount afresh (state, form errors and all) before they show again. A real
// unmount runs it too, harmlessly.
//
// React's Strict Mode (the development server) also runs the cleanup once
// right after the first mount and sets the effect up again at once, in the
// same task. That is no return to the page: the new key waits for a
// microtask, and an effect set up again before it cancels it. Without this,
// the form remounted a moment after loading and lost what the person had
// started, such as an open confirmation sheet.
export function FreshOnReturn({ children }: { children: ReactNode }) {
  const [round, setRound] = useState(0);
  const left = useRef(false);
  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
      queueMicrotask(() => {
        if (left.current) setRound((current) => current + 1);
      });
    };
  }, []);
  return <Fragment key={round}>{children}</Fragment>;
}
