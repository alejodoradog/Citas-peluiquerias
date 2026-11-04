"use client";

import {
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

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

// After a submit with errors, moves focus to the first invalid field so
// keyboard and screen reader users land on what needs fixing.
export function useFocusFirstError(errors: object | undefined) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      ?.focus();
  }, [errors]);
  return formRef;
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
      className="bg-brand hover:bg-brand-strong focus-visible:outline-ink h-12 w-full rounded-lg px-5 text-base font-bold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70"
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
