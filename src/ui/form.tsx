"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { IDLE, type FormState } from "@/lib/formularios/form-state";
import { buttonClasses, type ButtonVariant } from "./button";

// Wires a form to its Server Action: the state, the copy for each error code
// and the values to show again. Field names are typed, so a typo in
// fieldError("phnoe") does not compile.
type FieldOf<S> = S extends {
  status: "invalid";
  values: Partial<Record<infer F, string>>;
}
  ? F & string
  : never;
type CodeOf<S> = S extends { status: "failed"; error: infer C }
  ? C & string
  : never;

export function useFormAction<S extends FormState<string, string, string>>(
  action: (previous: S, formData: FormData) => Promise<S>,
  messages: Record<CodeOf<S> | "invalid", string>,
) {
  // React types the state as Awaited<S>; for a plain object that is S.
  const [state, formAction] = useActionState<S, FormData>(
    action as (previous: Awaited<S>, formData: FormData) => Promise<S>,
    IDLE as Awaited<S>,
  );
  const values: Partial<Record<string, string>> =
    state.status === "invalid" || state.status === "failed" ? state.values : {};
  const lookup = messages as Record<string, string>;

  return {
    formAction,
    // A new object after every submit, for screens that keep state of their
    // own next to the form (an uploaded photo, D-54).
    state,
    // Changes on every submit with errors, so ActionForm can move focus.
    invalidFields: state.status === "invalid" ? state.fieldErrors : undefined,
    notice: state.status === "done" ? state.notice : undefined,
    formError: state.status === "failed" ? lookup[state.error] : undefined,
    // The code behind formError, so the screen can pick the notice's tone.
    formErrorCode:
      state.status === "failed" ? (state.error as CodeOf<S>) : undefined,
    fieldError(field: FieldOf<S>): string | undefined {
      const code =
        state.status === "invalid" ? state.fieldErrors[field] : undefined;
      return code ? lookup[code] : undefined;
    },
    value(field: FieldOf<S>): string | undefined {
      return values[field];
    },
  };
}

// The form element for a useFormAction form. After a submit with errors it
// moves focus to the first invalid field, so keyboard and screen reader users
// land on what needs fixing. className replaces the column layout, for a
// form that wraps a whole flow screen (D-52) so its submit button can sit in
// the bottom bar.
export function ActionForm({
  form,
  children,
  className = "flex flex-col gap-5.5",
}: {
  form: { formAction: (formData: FormData) => void; invalidFields?: object };
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      ?.focus();
  }, [form.invalidFields]);

  return (
    <form ref={ref} action={form.formAction} noValidate className={className}>
      {children}
    </form>
  );
}

// disabled holds the form back while something it needs is not ready (a
// photo still uploading, D-54). variant: dangerSolid for a submit that
// deletes (task 2.6b).
export function SubmitButton({
  children,
  pendingText,
  disabled = false,
  variant = "primary",
}: {
  children: ReactNode;
  pendingText: string;
  disabled?: boolean;
  variant?: ButtonVariant;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      className={buttonClasses({ variant })}
    >
      {pending ? pendingText : children}
    </button>
  );
}
