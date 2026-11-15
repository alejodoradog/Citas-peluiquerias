"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

// How long a link may stay marked when its screen never arrives (a failed
// navigation, a file that downloads instead of opening).
export const PENDING_LIMIT_MS = 8_000;

type Pending = { element: HTMLElement; timer: number };

// Every link answers the tap at once. A screen that needs the server takes
// from 0.4 s to more than a second to arrive, and when only the query changes
// (another day of the agenda, a search) nothing else moves meanwhile. The
// tapped link, or the button of a search form, is marked with `data-pending`,
// which globals.css shows as "in progress", until the address changes.
//
// One listener for the whole app, in the root layout: no link can be left
// out, and the links of the hidden pages Next.js keeps mounted are covered
// too. Forms that run a Server Action show their own wait (SubmitButton,
// PendingButton): their address may not change at all.
export function TapFeedback() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const pending = useRef<Pending | null>(null);

  function clear() {
    if (!pending.current) return;
    window.clearTimeout(pending.current.timer);
    pending.current.element.removeAttribute("data-pending");
    pending.current = null;
  }

  // The address changed: the screen arrived.
  useEffect(clear, [pathname, search]);

  useEffect(() => {
    function mark(element: HTMLElement | null) {
      if (!element) return;
      clear();
      element.setAttribute("data-pending", "");
      pending.current = {
        element,
        timer: window.setTimeout(clear, PENDING_LIMIT_MS),
      };
    }
    const onClick = (event: MouseEvent) => mark(navigatingLink(event));
    const onSubmit = (event: SubmitEvent) => mark(searchingButton(event));
    // In the capture phase: before the link's or the form's own handler
    // starts the navigation.
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      clear();
    };
  }, []);

  return null;
}

// The link a click is about to follow to another screen of the app, or null:
// a click with a modifier key, a link to another site or another tab, a
// download, or a link to the screen already open.
function navigatingLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  if (!(event.target instanceof Element)) return null;
  const link = event.target.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return null;
  if (link.hasAttribute("download")) return null;
  if (link.target && link.target !== "_self") return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return null;
  }
  return link;
}

// The button of a form that searches: a GET form, which goes to its own
// address with the fields as the query. Null for a form that runs a Server
// Action, for one that goes to another site, and for a search that would
// land on the address already open.
function searchingButton(event: SubmitEvent): HTMLElement | null {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return null;
  if (form.method !== "get") return null;
  const url = new URL(form.action, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const query = new URLSearchParams();
  for (const [name, value] of new FormData(form, event.submitter)) {
    if (typeof value === "string") query.append(name, value);
  }
  if (
    url.pathname === window.location.pathname &&
    query.toString() === window.location.search.replace(/^\?/, "")
  ) {
    return null;
  }
  return (
    event.submitter ??
    form.querySelector<HTMLElement>('button:not([type="button"])')
  );
}
