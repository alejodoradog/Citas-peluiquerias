import { useId, type InputHTMLAttributes } from "react";
import { CheckIcon } from "./icons";

// Checkbox of F-01 on a native input, with the box drawn next to it. The row
// is the touch target, 44 px tall (the design's row measures about 36).
export function Checkbox({
  label,
  ...input
}: { label: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "id"
>) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5"
    >
      <input id={id} type="checkbox" className="peer sr-only" {...input} />
      <span
        aria-hidden="true"
        className="border-line-strong peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:outline-brand-strong flex size-6 shrink-0 items-center justify-center rounded-[7px] border-2 bg-white text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-60 [&>svg]:hidden peer-checked:[&>svg]:block"
      >
        <CheckIcon size={16} />
      </span>
      <span className="text-body font-semibold">{label}</span>
    </label>
  );
}
