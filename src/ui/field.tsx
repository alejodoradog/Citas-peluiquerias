import { useId, type InputHTMLAttributes } from "react";
import { WarningIcon } from "./icons";
import { textos } from "./textos";

type FieldProps = {
  label: string;
  name: string;
  help?: string;
  error?: string;
  optional?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id">;

// Text field of F-01: 14/600 label, 50 px input, 13 px help. With an error,
// the border turns red and 2 px wide, and the error replaces the help.
export function Field({
  label,
  name,
  help,
  error,
  optional = false,
  ...input
}: FieldProps) {
  const id = useId();
  const helpId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  // With an error, the error says what to do; the help would repeat it.
  const showHelp = Boolean(help) && !error;
  const describedBy = error ? errorId : showHelp ? helpId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label">
        {label}
        {optional ? (
          <span className="text-muted font-normal"> {textos.ui.opcional}</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="rounded-field border-line-strong text-ink focus-visible:border-brand aria-invalid:border-danger h-12.5 w-full border bg-white px-3.5 text-base aria-invalid:border-2 aria-invalid:px-3.25"
        {...input}
      />
      {error ? (
        <p
          id={errorId}
          className="text-help text-danger flex items-start gap-1.5"
        >
          <span className="flex pt-px">
            <WarningIcon size={16} />
          </span>
          <span>{error}</span>
        </p>
      ) : null}
      {showHelp ? (
        <p id={helpId} className="text-help text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
