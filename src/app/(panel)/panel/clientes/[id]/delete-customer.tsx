"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DeleteCustomerState } from "@/modulos/clientes/acciones/customers";
import { Button } from "@/ui/button";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { TrashIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.clientes.borrar;

type DeleteAction = (
  previous: DeleteCustomerState,
  formData: FormData,
) => Promise<DeleteCustomerState>;

// The sheet's form: what goes and what stays, then "Borrar cliente". The
// action anonymizes the customer and goes back to the list (D-42).
function DeleteForm({
  customerId,
  action,
  onCancel,
}: {
  customerId: string;
  action: DeleteAction;
  onCancel: () => void;
}) {
  const form = useFormAction(action, t.errores);
  return (
    <ActionForm form={form} className="flex flex-col gap-3.5">
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <p className="text-body text-muted">{t.cuerpo}</p>
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex flex-col gap-2.5">
        <SubmitButton variant="dangerSolid" pendingText={t.borrando}>
          {t.confirmar}
        </SubmitButton>
        <Button variant="secondary" onClick={onCancel}>
          {t.volver}
        </Button>
      </div>
    </ActionForm>
  );
}

// D-41's trash icon in the top bar, and D-42 over the profile. The sheet
// goes to the end of the body, out of the notes form, and exists only while
// open, so the server renders none.
export function DeleteCustomer({
  customerId,
  name,
  action,
}: {
  customerId: string;
  name: string;
  action: DeleteAction;
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
    <>
      <button
        ref={opener}
        type="button"
        aria-label={t.boton}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="text-danger hover:text-ink flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <TrashIcon size={20} />
      </button>
      {open
        ? createPortal(
            <Sheet open onClose={() => setOpen(false)} title={t.titulo(name)}>
              <DeleteForm
                customerId={customerId}
                action={action}
                onCancel={() => setOpen(false)}
              />
            </Sheet>,
            document.body,
          )
        : null}
    </>
  );
}
