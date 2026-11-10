import { useId, type InputHTMLAttributes } from "react";

// Switch of F-01 on a native checkbox with role="switch": it works without
// JavaScript and its value travels in the form like any other field. The row
// is the touch target, 44 px tall.
export function Switch({
  label,
  description,
  ...input
}: {
  label: string;
  description?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role" | "id">) {
  const id = useId();
  const labelId = `${id}-etiqueta`;
  const descriptionId = `${id}-descripcion`;
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1"
    >
      <span className="flex flex-col gap-0.5">
        <span id={labelId} className="text-body font-semibold">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="text-help text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        // Named by the label text alone; the detail is its description.
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        className="peer sr-only"
        {...input}
      />
      <span
        aria-hidden="true"
        className="bg-line-strong peer-checked:bg-brand peer-focus-visible:outline-brand-strong flex h-7 w-12 shrink-0 rounded-full p-1 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-60 peer-checked:[&>span]:translate-x-5"
      >
        <span className="size-5 rounded-full bg-white transition-transform" />
      </span>
    </label>
  );
}
