"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { routes } from "@/lib/routes";
import { displayBookingUrl } from "@/lib/sitio";
import type {
  BookingLinkState,
  SlugCheck,
} from "@/modulos/barberias/acciones/booking-link";
import { cx } from "@/ui/cx";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { CheckIcon, WarningIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";

const t = textos.link;

// How long the owner stops typing before the link is looked up.
export const CHECK_DELAY_MS = 400;

// What the screen knows about the link typed, since the server last answered
// a "Cambiar link".
type Availability =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "checked"; result: SlugCheck; typed: string }
  // The lookup failed: the owner may still try, the server checks again.
  | { kind: "unchecked" };

// The line under the field: what it says and how.
type Status = { tone: "muted" | "success" | "danger"; text: string } | null;

// D-61: the current link, the new one after a fixed "yapoin.com/", whether
// it is free while the owner types, and that the old link keeps leading to
// the new one (decision P1 of task 2.4). The server checks everything again
// and the database has the last word.
export function BookingLinkForm({
  action,
  check,
  current,
  changed,
}: {
  action: (
    previous: BookingLinkState,
    formData: FormData,
  ) => Promise<BookingLinkState>;
  check: (input: string) => Promise<SlugCheck>;
  current: string;
  // Back from "Cambiar link".
  changed: boolean;
}) {
  const form = useFormAction(action, t.errores);
  // Tagged with the answer of the server it follows: once a new one arrives,
  // the screen shows that answer until the owner types again.
  const [availability, setAvailability] = useState<{
    after: BookingLinkState;
    value: Availability;
  }>({ after: form.state, value: { kind: "idle" } });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastRequest = useRef(0);
  const id = useId();
  const statusId = `${id}-estado`;

  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const typed = event.currentTarget.value;
    const after = form.state;
    const request = ++lastRequest.current;
    clearTimeout(timer.current);
    setAvailability({ after, value: { kind: "checking" } });
    timer.current = setTimeout(() => {
      check(typed).then(
        (result) => {
          if (request !== lastRequest.current) return;
          setAvailability({
            after,
            value: { kind: "checked", result, typed },
          });
        },
        () => {
          if (request !== lastRequest.current) return;
          setAvailability({ after, value: { kind: "unchecked" } });
        },
      );
    }, CHECK_DELAY_MS);
  }

  const fresh = availability.after === form.state;
  const serverError = fresh ? undefined : form.fieldError("slug");
  const status: Status = serverError
    ? { tone: "danger", text: serverError }
    : fresh
      ? statusOf(availability.value)
      : null;
  const canSubmit = fresh
    ? (availability.value.kind === "checked" &&
        availability.value.result.status === "available") ||
      availability.value.kind === "unchecked"
    : form.formErrorCode === "unknown";
  const invalid = status?.tone === "danger";

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <FlowShell
        header={
          <TopBar
            title={t.titulo}
            titleAs="h1"
            back={{ href: routes.panelMore, label: textos.ui.volver }}
          />
        }
        actions={
          <SubmitButton pendingText={t.cambiando} disabled={!canSubmit}>
            {t.cambiar}
          </SubmitButton>
        }
      >
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : changed ? (
          <Notice
            tone="success"
            title={t.cambiado(displayBookingUrl(current))}
            action={<Link href={routes.panelShare}>{t.compartir}</Link>}
          >
            {t.cambiadoDetalle}
          </Notice>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <span className="text-help text-muted">{t.actual}</span>
          <span className="text-body leading-[1.4] font-semibold break-all">
            {displayBookingUrl(current)}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-label">
            {t.nuevo}
          </label>
          <div
            data-field="slug"
            className={cx(
              "rounded-field text-ink flex h-12.5 items-center overflow-hidden border bg-white focus-within:outline-2 focus-within:outline-offset-2",
              invalid
                ? "border-danger border-2"
                : "border-line-strong focus-within:border-brand",
              "focus-within:outline-brand-strong",
            )}
          >
            <span
              aria-hidden="true"
              className="text-muted shrink-0 pr-1 pl-3.5 text-base"
            >
              {displayBookingUrl("")}
            </span>
            <input
              id={id}
              name="slug"
              type="text"
              defaultValue={form.value("slug") ?? current}
              onChange={onChange}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={statusId}
              className="h-full min-w-0 flex-1 border-0 bg-transparent pr-3.5 text-base focus-visible:outline-none"
            />
          </div>
          <p
            id={statusId}
            aria-live="polite"
            className={cx(
              "text-help flex items-start gap-1.5 empty:hidden",
              status?.tone === "success"
                ? "text-success"
                : status?.tone === "danger"
                  ? "text-danger"
                  : "text-muted",
            )}
          >
            {status ? (
              <>
                {status.tone === "success" ? (
                  <span className="flex pt-px">
                    <CheckIcon size={16} />
                  </span>
                ) : status.tone === "danger" ? (
                  <span className="flex pt-px">
                    <WarningIcon size={16} />
                  </span>
                ) : null}
                <span>{status.text}</span>
              </>
            ) : null}
          </p>
        </div>
        <Notice tone="info" title={t.aviso}>
          {t.avisoDetalle}
        </Notice>
      </FlowShell>
    </ActionForm>
  );
}

function statusOf(availability: Availability): Status {
  switch (availability.kind) {
    case "idle":
      return null;
    case "checking":
      return { tone: "muted", text: t.revisando };
    case "unchecked":
      return { tone: "muted", text: t.sinRevisar };
    case "checked": {
      const { result, typed } = availability;
      if (result.status === "refused") {
        return result.error === "slug_same"
          ? { tone: "muted", text: t.errores.slug_same }
          : { tone: "danger", text: t.errores[result.error] };
      }
      if (result.status === "taken") {
        return { tone: "danger", text: t.errores.slug_taken };
      }
      // What was typed became another link ("La Esquina"): say which.
      return {
        tone: "success",
        text:
          result.slug === typed
            ? t.disponible
            : t.disponibleComo(displayBookingUrl(result.slug)),
      };
    }
  }
}
