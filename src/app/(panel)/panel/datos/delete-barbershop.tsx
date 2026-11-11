"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { routes } from "@/lib/routes";
import type { DeleteBarbershopState } from "@/modulos/barberias/acciones/barbershops";
import { confirmsBarbershopName } from "@/modulos/barberias/dominio/barbershop-rules";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";
import { rememberDeletedBarbershop } from "../sedes/deleted-notice";

const t = textos.sedes.eliminar;

type DeleteAction = (
  previous: DeleteBarbershopState,
  formData: FormData,
) => Promise<DeleteBarbershopState>;

function fullPageLoad(path: string) {
  window.location.assign(path);
}

// The sheet's form: what goes away, and the sede's name to type before
// "Eliminar" turns on. The server checks the name again and deletes the sede
// it has as active; the id sent here only has to match it (another tab may
// have switched sede).
function DeleteForm({
  barbershopId,
  name,
  action,
  onCancel,
  onDeleted,
}: {
  barbershopId: string;
  name: string;
  action: DeleteAction;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  // Setting the active sede re-renders the page for the sede left, which
  // unmounts this form before its state could say "deleted". So the page
  // goes away from the action's own answer, which runs either way.
  const deleteAndLeave = useCallback<DeleteAction>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.status === "done" && result.notice === "deleted") {
        onDeleted();
      }
      return result;
    },
    [action, onDeleted],
  );
  const form = useFormAction(deleteAndLeave, t.errores);
  const [typed, setTyped] = useState("");
  const deleted = form.notice === "deleted";

  return (
    <ActionForm form={form}>
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <p className="text-body">{t.bajada(name)}</p>
      <p className="text-body text-muted">{t.link}</p>
      <input type="hidden" name="barbershopId" value={barbershopId} />
      <Field
        label={t.campo}
        name="confirmName"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        error={form.fieldError("confirmName")}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
      />
      <div className="flex flex-col gap-2.5">
        <SubmitButton
          variant="dangerSolid"
          pendingText={t.eliminando}
          disabled={deleted || !confirmsBarbershopName(typed, name)}
        >
          {deleted ? t.eliminando : t.confirmar}
        </SubmitButton>
        <Button variant="secondary" onClick={onCancel} disabled={deleted}>
          {t.cancelar}
        </Button>
      </div>
    </ActionForm>
  );
}

// Task 2.6b, at the end of D-57 "Datos y fotos": "Eliminar esta sede", only
// when the account has another sede (the page decides). The sheet goes to
// the end of the body: this screen is itself one form, and a form cannot
// hold another. It exists only while open, so the server renders none.
// Once deleted, the panel loads in full on the agenda of the oldest sede
// left (a client navigation would leave hidden pages of the deleted one).
export function DeleteBarbershop({
  barbershopId,
  name,
  action,
  goTo = fullPageLoad,
}: {
  barbershopId: string;
  name: string;
  action: DeleteAction;
  // Where a deletion lands; a full page load, replaced in tests.
  goTo?: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // The sheet unmounts on close, so focus goes back to its button here.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      opener.current?.focus();
    }
  }, [open]);

  return (
    <section className="flex flex-col gap-2.5 pt-4">
      <h2 className="text-label text-muted">{t.seccion}</h2>
      <Button
        ref={opener}
        variant="danger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {t.boton}
      </Button>
      {open
        ? createPortal(
            <Sheet open onClose={() => setOpen(false)} title={t.titulo}>
              <DeleteForm
                barbershopId={barbershopId}
                name={name}
                action={action}
                onCancel={() => setOpen(false)}
                onDeleted={() => {
                  rememberDeletedBarbershop(name);
                  goTo(routes.panel);
                }}
              />
            </Sheet>,
            document.body,
          )
        : null}
    </section>
  );
}
