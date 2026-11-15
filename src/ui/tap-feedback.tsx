"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// How long a link may stay marked when its screen never arrives (a failed
// navigation, a file that downloads instead of opening).
export const PENDING_LIMIT_MS = 8_000;

// Where the tap is going: another address of the app.
type Target = { pathname: string; search: string };
type Tapped = { element: HTMLElement; target: Target };

// The navigation in progress, for the screens that wait with ScreenSuspense.
// One for the whole app: there is one address bar.
let waitingFor: Target | null = null;
const listeners = new Set<() => void>();
function setWaitingFor(target: Target | null) {
  if (waitingFor === target) return;
  waitingFor = target;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const readWaitingFor = () => waitingFor;
const noWait = () => null;

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
  const pending = useRef<{ element: HTMLElement; timer: number } | null>(null);

  function clear() {
    setWaitingFor(null);
    if (!pending.current) return;
    window.clearTimeout(pending.current.timer);
    pending.current.element.removeAttribute("data-pending");
    pending.current = null;
  }

  // The address changed: the screen arrived. Before the browser paints, so
  // a screen that waited (ScreenSuspense) shows the new content in the same
  // frame.
  useLayoutEffect(clear, [pathname, search]);

  useEffect(() => {
    function mark(tapped: Tapped | null) {
      if (!tapped) return;
      clear();
      tapped.element.setAttribute("data-pending", "");
      pending.current = {
        element: tapped.element,
        timer: window.setTimeout(clear, PENDING_LIMIT_MS),
      };
      setWaitingFor(tapped.target);
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

// The Suspense of a screen whose links lead back to itself with another
// query: the day and the view of the agenda, a filter, a search, the steps of
// the booking. Going to another screen, Next.js shows that screen's loading
// state at once, from what it fetched ahead. Staying on the same one, it
// keeps the old content on screen until the new one arrives, so the tap seems
// to do nothing for half a second. Here the same loading state shows from
// the tap, and the content comes back when the address changes.
export function ScreenSuspense({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <SameScreenWait fallback={fallback}>{children}</SameScreenWait>
    </Suspense>
  );
}

function SameScreenWait({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const target = useSyncExternalStore(subscribe, readWaitingFor, noWait);
  const waiting = target !== null && target.pathname === pathname;
  // What had the focus when the content was hidden gets it back: the link
  // that was tapped is usually still there, with its new address.
  const focused = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (waiting) {
      const active = document.activeElement;
      focused.current =
        active instanceof HTMLElement && content.current?.contains(active)
          ? active
          : null;
      return;
    }
    const last = focused.current;
    focused.current = null;
    if (last?.isConnected && document.activeElement === document.body) {
      last.focus({ preventScroll: true });
    }
  }, [waiting]);

  return (
    <>
      {waiting ? fallback : null}
      {/* Hidden, not removed: what the screen holds (an open sheet, what
          was typed) is still there if the navigation fails. */}
      <div ref={content} hidden={waiting} className="contents">
        {children}
      </div>
    </>
  );
}

// The link a click is about to follow to another screen of the app, or null:
// a click with a modifier key, a link to another site or another tab, a
// download, or a link to the screen already open.
function navigatingLink(event: MouseEvent): Tapped | null {
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
  return {
    element: link,
    target: { pathname: url.pathname, search: url.search },
  };
}

// The button of a form that searches: a GET form, which goes to its own
// address with the fields as the query. Null for a form that runs a Server
// Action, for one that goes to another site, and for a search that would
// land on the address already open.
function searchingButton(event: SubmitEvent): Tapped | null {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return null;
  if (form.method !== "get") return null;
  const url = new URL(form.action, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const query = new URLSearchParams();
  for (const [name, value] of new FormData(form, event.submitter)) {
    if (typeof value === "string") query.append(name, value);
  }
  const search = query.toString();
  if (
    url.pathname === window.location.pathname &&
    search === window.location.search.replace(/^\?/, "")
  ) {
    return null;
  }
  return {
    // A search sent with the keyboard and no button marks the form itself.
    element:
      event.submitter ??
      form.querySelector<HTMLElement>('button:not([type="button"])') ??
      form,
    target: { pathname: url.pathname, search: search ? `?${search}` : "" },
  };
}
