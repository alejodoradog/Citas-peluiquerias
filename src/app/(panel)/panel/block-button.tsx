"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { AppointmentState } from "@/modulos/agenda/acciones/owner-appointment";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.agenda.bloqueoHoja;

// removeOwnerBlock, passed down by the page, so this file never imports the
// server's code (and the views can be tested on their own).
export type RemoveBlockAction = (
  previous: AppointmentState,
  formData: FormData,
) => Promise<AppointmentState>;

// A block of the agenda (D-30, D-31), task 4.2: a tap opens a sheet with who
// and when, and "Quitar bloqueo" while it has not ended (decision A11 of 4.1
// left this for 4.2).
export function BlockButton({
  id,
  className,
  style,
  detail,
  end,
  action,
  children,
}: {
  id: string;
  action: RemoveBlockAction;
  className: string;
  style?: CSSProperties;
  // "Kevin · 1:00 – 2:00 p. m."
  detail: string;
  // When the block ends: one that ended cannot be removed.
  end: Date;
  children: ReactNode;
}) {
  // When the sheet was opened: whether the block ended is read then, in the
  // tap, never while rendering the agenda.
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  // The sheet exists only while open, so its title is not part of the
  // agenda's rows; focus goes back to the block when it closes.
  const close = () => {
    setOpenedAt(null);
    button.current?.focus();
  };
  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpenedAt(Date.now())}
        className={`${className} cursor-pointer text-left`}
        style={style}
        data-to-scale=""
      >
        {children}
      </button>
      {openedAt !== null ? (
        <Sheet open onClose={close} title={t.titulo}>
          <RemoveBlock
            id={id}
            detail={detail}
            ended={end.getTime() <= openedAt}
            action={action}
            onDone={close}
          />
        </Sheet>
      ) : null}
    </>
  );
}

function RemoveBlock({
  id,
  detail,
  ended,
  action,
  onDone,
}: {
  id: string;
  action: RemoveBlockAction;
  detail: string;
  ended: boolean;
  onDone: () => void;
}) {
  const form = useFormAction(action, textos.agenda.rechazos);
  const done = form.state.status === "done";
  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  return (
    <ActionForm form={form} className="flex flex-col gap-3.5">
      <input type="hidden" name="bloqueo" value={id} />
      <p className="text-body text-muted">{detail}</p>
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      {ended ? (
        <p className="text-help text-muted">{t.terminado}</p>
      ) : (
        <SubmitButton pendingText={t.enviando} variant="danger">
          {t.quitar}
        </SubmitButton>
      )}
    </ActionForm>
  );
}
