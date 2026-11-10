import type { SelectHTMLAttributes } from "react";
import { cx } from "./cx";
import { fieldControlClasses, FieldFrame, useFieldDescription } from "./field";
import { ChevronRightIcon } from "./icons";

export type SelectOption = { value: string; label: string };

// A native select dressed as a text field of F-01 (the duration of a service,
// D-11). Native, so phones open their own picker and it works without
// JavaScript. The chevron is drawn over it and ignores taps.
export function SelectField({
  label,
  name,
  options,
  help,
  error,
  optional = false,
  ...select
}: {
  label: string;
  name: string;
  options: ReadonlyArray<SelectOption>;
  help?: string;
  error?: string;
  optional?: boolean;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "name" | "id">) {
  const { id, helpId, errorId, showHelp, describedBy } = useFieldDescription(
    help,
    error,
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
      <div className="relative">
        <select
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            fieldControlClasses,
            "cursor-pointer appearance-none pr-10 pl-3.5 aria-invalid:pr-9.75 aria-invalid:pl-3.25",
          )}
          {...select}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-muted pointer-events-none absolute inset-y-0 right-3.5 flex items-center [&>svg]:rotate-90">
          <ChevronRightIcon size={18} />
        </span>
      </div>
    </FieldFrame>
  );
}
