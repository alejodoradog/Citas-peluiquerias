import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";
import { WarningIcon } from "./icons";
import { textos } from "./textos";

type FieldProps = {
  label: string;
  name: string;
  help?: string;
  error?: string;
  optional?: boolean;
  // A short mark inside the field, before the value (the "$" of a price).
  // Decorative: the label already says what the value is.
  prefix?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "prefix">;

// Border, size and text shared by every field of F-01: 50 px tall, 16 px text
// so phones do not zoom in, and a red 2 px border with an error.
export const fieldControlClasses =
  "rounded-field border-line-strong text-ink focus-visible:border-brand aria-invalid:border-danger h-12.5 w-full border bg-white text-base aria-invalid:border-2";

// The ids that tie a field to its help or its error. With an error, the error
// says what to do; the help would repeat it, so it is not shown.
export function useFieldDescription(help?: string, error?: string) {
  const id = useId();
  const helpId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const showHelp = Boolean(help) && !error;
  return {
    id,
    helpId,
    errorId,
    showHelp,
    describedBy: error ? errorId : showHelp ? helpId : undefined,
  };
}

// Label, control and the help or the error under it.
export function FieldFrame({
  id,
  label,
  optional = false,
  help,
  error,
  helpId,
  errorId,
  showHelp,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  help?: string;
  error?: string;
  helpId: string;
  errorId: string;
  showHelp: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label">
        {label}
        {optional ? (
          <span className="text-muted font-normal"> {textos.ui.opcional}</span>
        ) : null}
      </label>
      {children}
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

// Text field of F-01: 14/600 label, 50 px input, 13 px help. With an error,
// the border turns red and 2 px wide, and the error replaces the help.
export function Field({
  label,
  name,
  help,
  error,
  optional = false,
  prefix,
  ...input
}: FieldProps) {
  const { id, helpId, errorId, showHelp, describedBy } = useFieldDescription(
    help,
    error,
  );

  const control = (
    <input
      id={id}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cx(
        fieldControlClasses,
        // The 2 px error border takes its extra pixel from the padding, so
        // the text does not move.
        prefix
          ? "pr-3.5 pl-7.5 aria-invalid:pr-3.25 aria-invalid:pl-7.25"
          : "px-3.5 aria-invalid:px-3.25",
      )}
      {...input}
    />
  );

  return (
    <FieldFrame
      id={id}
      label={label}
      optional={optional}
      help={help}
      error={error}
      helpId={helpId}
      errorId={errorId}
      showHelp={showHelp}
    >
      {prefix ? (
        <div className="relative">
          <span
            aria-hidden="true"
            data-prefix="true"
            className="text-ink pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base"
          >
            {prefix}
          </span>
          {control}
        </div>
      ) : (
        control
      )}
    </FieldFrame>
  );
}
