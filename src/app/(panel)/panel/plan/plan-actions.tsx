"use client";

import { useState } from "react";
import {
  cancelPlanUpgrade,
  requestPlanUpgrade,
} from "@/modulos/suscripciones/acciones/plan-changes";
import { buttonClasses } from "@/ui/button";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.planes.plan;

// "Cambiar al plan 2": a sheet that says what to pay and how, then sends the
// request (task 7.8b).
export function UpgradeButton({
  amount,
  howToPay,
}: {
  amount: string;
  howToPay: string;
}) {
  const [open, setOpen] = useState(false);
  const form = useFormAction(requestPlanUpgrade, t.errores);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses()}
      >
        {t.subir.boton}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.hoja.titulo}>
        <ActionForm form={form} className="flex flex-col gap-3.5">
          {form.formError ? (
            <Notice tone="danger" title={form.formError} />
          ) : null}
          <p className="text-body">{t.hoja.cuerpo(amount)}</p>
          <p className="text-body text-muted">{howToPay}</p>
          <SubmitButton pendingText={t.hoja.enviando}>
            {t.hoja.enviar}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClasses({ variant: "secondary" })}
          >
            {t.hoja.volver}
          </button>
        </ActionForm>
      </Sheet>
    </>
  );
}

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const form = useFormAction(cancelPlanUpgrade, t.errores);
  return (
    <ActionForm form={form} className="flex flex-col gap-2">
      <input type="hidden" name="solicitud" value={requestId} />
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <SubmitButton pendingText={t.pendiente.cancelando} variant="secondary">
        {t.pendiente.cancelar}
      </SubmitButton>
    </ActionForm>
  );
}
