"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

// A submit button for a form that already has its own look (a row, a card
// action) and needs the house pending state: from the tap on, every button of
// the form is disabled so it cannot be sent twice, and the one that was
// pressed swaps its text. A button with name and value (two choices in one
// form) shows the text only when its own value was the one sent.
export function PendingButton({
  pendingText,
  children,
  disabled = false,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { pendingText: string }) {
  const { pending, data } = useFormStatus();
  const pressed =
    pending &&
    (props.name === undefined || data?.get(props.name) === props.value);
  return (
    <button
      type="submit"
      {...props}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      aria-busy={pressed || undefined}
    >
      {pressed ? pendingText : children}
    </button>
  );
}
