"use client";

import { useLayoutEffect, useRef } from "react";

// React resets a form after its action, which puts every select back on its
// first option and every switch on its default, while the screen's state
// still holds what the owner chose. Layout effects run after that reset, so
// the controls show the state again before the screen paints. Controls opt in
// with data-value (selects) and data-checked (switches).
export function useRestoredControls() {
  const controls = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = controls.current;
    if (!root) return;
    for (const select of root.querySelectorAll<HTMLSelectElement>(
      "select[data-value]",
    )) {
      if (select.value !== select.dataset.value) {
        select.value = select.dataset.value!;
      }
    }
    for (const box of root.querySelectorAll<HTMLInputElement>(
      "input[data-checked]",
    )) {
      box.checked = box.dataset.checked === "true";
    }
  });
  return controls;
}
