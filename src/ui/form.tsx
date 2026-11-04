"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { IDLE, type FormState } from "@/lib/formularios/form-state";
import { buttonClasses } from "./button";

type FieldProps = {
  label: string;
  name: string;
  help?: string;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id">;

export function Field({ label, name, help, error, ...input }: FieldProps) {
  const id = useId();
  const helpId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  // With an error, the error says what to do; the help would repeat it.
  const showHelp = Boolean(help) && !error;
  const describedBy = error ? errorId : showHelp ? helpId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="border-line text-ink focus-visible:border-brand focus-visible:outline-brand aria-invalid:border-danger h-12 rounded-lg border-2 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1"
        {...input}
      />
      {error ? (
        <p id={errorId} className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}
      {showHelp ? (
        <p id={helpId} className="text-muted text-sm">
          {help}
        </p>
      ) : null}
    </div>
  );
}

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
    // Changes on every submit with errors, so ActionForm can move focus.
    invalidFields: state.status === "invalid" ? state.fieldErrors : undefined,
    notice: state.status === "done" ? state.notice : undefined,
    formError: state.status === "failed" ? lookup[state.error] : undefined,
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
// land on what needs fixing.
export function ActionForm({
  form,
  children,
}: {
  form: { formAction: (formData: FormData) => void; invalidFields?: object };
  children: ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      ?.focus();
  }, [form.invalidFields]);

  return (
    <form
      ref={ref}
      action={form.formAction}
      noValidate
      className="flex flex-col gap-5"
    >
      {children}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingText,
}: {
  children: ReactNode;
  pendingText: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={buttonClasses("primary")}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormAlert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "info";
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "bg-danger-soft text-danger rounded-lg px-4 py-3 text-base font-medium"
          : "border-brand text-ink rounded-lg border-l-4 bg-white px-4 py-3 text-base"
      }
    >
      {children}
    </p>
  );
}
