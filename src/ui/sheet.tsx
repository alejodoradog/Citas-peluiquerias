"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
import { textos } from "./textos";

// Bottom sheet of the design (D-11 "Editar servicio") on a native modal
// <dialog>: the browser keeps focus inside it, hides the rest of the page from
// screen readers and turns Escape into a cancel event. It closes with its
// button, with Escape and with a tap on the dimmed backdrop, and gives focus
// back to whatever opened it. The parent owns `open`; every way of closing
// asks the parent through onClose.
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    opener.current?.focus();
    opener.current = null;
    // Closed by the browser while the parent still has it open.
    if (open) onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={handleClose}
      onCancel={(event) => {
        // Escape: let the parent decide, so `open` stays the truth.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A tap on the backdrop lands on the dialog itself; the content
        // covers the rest of it.
        if (event.target === event.currentTarget) onClose();
      }}
      className="text-ink backdrop:bg-ink/45 mx-auto mt-auto mb-0 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-t-[1.375rem] border-0 bg-white p-0"
    >
      <div className="flex flex-col gap-3.5 px-5 pt-2.5 pb-[max(1.625rem,env(safe-area-inset-bottom))]">
        <div
          aria-hidden="true"
          data-handle="true"
          className="bg-line h-1 w-10 self-center rounded-sm"
        />
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-section">
            {title}
          </h2>
          <button
            type="button"
            aria-label={textos.ui.cerrar}
            onClick={onClose}
            className="text-ink -mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <CloseIcon size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
