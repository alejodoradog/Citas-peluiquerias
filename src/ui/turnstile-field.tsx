"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TURNSTILE_FIELD, TURNSTILE_SITE_KEY } from "@/lib/turnstile/keys";
import { SubmitButton } from "./form";

// Cloudflare Turnstile in "Managed" mode (task 3.5): invisible for almost
// everyone, a single checkbox only when Cloudflare doubts. It fills the
// hidden field the server action reads. A token works once, so the widget
// asks for a new one after every submit (resetKey changes with the form's
// state). onReady says whether there is a token, so the form can wait for
// it before sending.

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error());
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function TurnstileField({
  resetKey,
  onReady,
}: {
  resetKey?: unknown;
  onReady?: (ready: boolean) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const ready = useRef(onReady);
  const [token, setToken] = useState("");

  useEffect(() => {
    ready.current = onReady;
  });

  useEffect(() => {
    let gone = false;
    const take = (value: string) => {
      setToken(value);
      ready.current?.(value !== "");
    };
    loadTurnstile()
      .then((api) => {
        if (gone || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: "es",
          appearance: "interaction-only",
          callback: (value: string) => take(value),
          "expired-callback": () => take(""),
          "error-callback": () => take(""),
        });
      })
      .catch(() => take(""));
    return () => {
      // React may mount twice in development (Strict Mode): the first
      // widget goes away before the second one is drawn.
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  // A new token after every submit: the last one was spent.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (widget.current && window.turnstile) {
      window.turnstile.reset(widget.current);

      setToken("");
      ready.current?.(false);
    }
  }, [resetKey]);

  return (
    <>
      <div ref={box} className="empty:hidden" />
      <input type="hidden" name={TURNSTILE_FIELD} value={token} />
    </>
  );
}

// The submit button of a form Turnstile protects: it waits for the token,
// and a new one comes after every submit. `state` is the form's state
// (useFormAction), which changes on every submit.
export function ProtectedSubmit({
  state,
  pendingText,
  children,
}: {
  state: unknown;
  pendingText: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  return (
    <>
      <TurnstileField resetKey={state} onReady={setReady} />
      <SubmitButton pendingText={pendingText} disabled={!ready}>
        {children}
      </SubmitButton>
    </>
  );
}
