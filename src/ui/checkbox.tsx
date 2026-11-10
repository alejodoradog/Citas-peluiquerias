import { useId, type InputHTMLAttributes } from "react";
import { cx } from "./cx";
import { CheckIcon } from "./icons";

const boxes = {
  md: "size-6 rounded-[7px]",
  // The larger box of the service list (D-10).
  lg: "size-7 rounded-lg",
} as const;

// Checkbox of F-01 on a native input, with the box drawn next to it. The row
// is the touch target, 44 px tall (the design's row measures about 36). With
// hideLabel only the box shows (a list row that names it already, D-10); the
// label stays for screen readers and the target stays 44 × 44.
export function Checkbox({
  label,
  description,
  size = "md",
  hideLabel = false,
  ...input
}: {
  label: string;
  description?: string;
  size?: keyof typeof boxes;
  hideLabel?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id" | "size">) {
  const id = useId();
  const labelId = `${id}-etiqueta`;
  const descriptionId = `${id}-descripcion`;
  return (
    <label
      htmlFor={id}
      className={cx(
        "flex min-h-11 cursor-pointer items-center gap-3 py-1.5",
        hideLabel && "min-w-11 shrink-0 justify-center",
      )}
    >
      <input
        id={id}
        type="checkbox"
        // Named by the label text alone; the detail is its description.
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        className="peer sr-only"
        {...input}
      />
      <span
        aria-hidden="true"
        className={cx(
          "border-line-strong peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:outline-brand-strong flex shrink-0 items-center justify-center border-2 bg-white text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-60 [&>svg]:hidden peer-checked:[&>svg]:block",
          boxes[size],
        )}
      >
        <CheckIcon size={16} />
      </span>
      <span className={cx("flex flex-col gap-0.5", hideLabel && "sr-only")}>
        <span
          id={labelId}
          className={cx("text-body font-semibold", hideLabel && "sr-only")}
        >
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="text-help text-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
