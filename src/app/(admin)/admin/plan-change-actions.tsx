"use client";

import { useState } from "react";
import {
  acceptPlanChange,
  rejectPlanChange,
  voidPlanChange,
} from "@/modulos/suscripciones/acciones/plan-changes";
import { buttonClasses } from "@/ui/button";
import { Field } from "@/ui/field";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { SelectField, type SelectOption } from "@/ui/select-field";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.plataforma;
const s = t.solicitudes;

// Task 7.8b: a request is accepted only by registering the payment of the
// difference, with the same data as P-03 and the value the sheet shows.
export function AcceptPlanChangeButton({
  requestId,
  name,
  amount,
  amountCop,
  methods,
  days,
}: {
  requestId: string;
  name: string;
  amount: string;
  amountCop: number;
  methods: SelectOption[];
  days: SelectOption[];
}) {
  const [open, setOpen] = useState(false);
  const form = useFormAction(acceptPlanChange, t.errores);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses({ size: "md" })}
      >
        {s.aceptar}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={s.hojaAceptar.titulo}
      >
        <ActionForm form={form} className="flex flex-col gap-3.5">
          <input type="hidden" name="solicitud" value={requestId} />
          <input type="hidden" name="valor" value={amountCop} />
          {form.formError ? (
            <Notice tone="danger" title={form.formError} />
          ) : null}
          <p className="text-body text-muted">
            {s.hojaAceptar.detalle(name, amount)}
          </p>
          <SelectField
            label={t.pago.medio}
            name="metodo"
            options={methods}
            defaultValue={form.value("metodo") ?? methods[0]?.value}
            error={form.fieldError("metodo")}
          />
          <Field
            label={t.pago.referencia}
            name="referencia"
            defaultValue={form.value("referencia")}
            error={form.fieldError("referencia")}
            maxLength={100}
            required
          />
          <SelectField
            label={t.pago.fecha}
            name="fecha"
            options={days}
            defaultValue={form.value("fecha") ?? days[0]?.value}
            error={form.fieldError("fecha")}
          />
          <SubmitButton pendingText={s.hojaAceptar.enviando}>
            {s.hojaAceptar.enviar}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClasses({ variant: "secondary" })}
          >
            {s.volver}
          </button>
        </ActionForm>
      </Sheet>
    </>
  );
}

export function RejectPlanChangeButton({
  requestId,
  name,
}: {
  requestId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const form = useFormAction(rejectPlanChange, t.errores);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses({ variant: "secondary", size: "md" })}
      >
        {s.rechazar}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={s.hojaRechazar.titulo}
      >
        <ActionForm form={form} className="flex flex-col gap-3.5">
          <input type="hidden" name="solicitud" value={requestId} />
          {form.formError ? (
            <Notice tone="danger" title={form.formError} />
          ) : null}
          <p className="text-body text-muted">{s.hojaRechazar.detalle(name)}</p>
          <Field
            label={s.hojaRechazar.motivo}
            name="motivo"
            defaultValue={form.value("motivo")}
            error={form.fieldError("motivo")}
            maxLength={200}
          />
          <SubmitButton
            pendingText={s.hojaRechazar.enviando}
            variant="dangerSolid"
          >
            {s.hojaRechazar.enviar}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClasses({ variant: "secondary" })}
          >
            {s.volver}
          </button>
        </ActionForm>
      </Sheet>
    </>
  );
}

// From the ficha (P-02): voiding the payment of a difference takes the
// establishment back to its plan.
export function VoidPlanChangeButton({
  barbershopId,
  requestId,
  label,
  detail,
}: {
  barbershopId: string;
  requestId: string;
  label: string;
  detail: string;
}) {
  const [open, setOpen] = useState(false);
  const form = useFormAction(voidPlanChange, t.errores);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className="text-danger min-h-11 shrink-0 px-2 text-[13px] font-semibold"
      >
        {s.ficha.anular}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.anular.titulo}>
        <ActionForm form={form} className="flex flex-col gap-3.5">
          <input type="hidden" name="barberia" value={barbershopId} />
          <input type="hidden" name="solicitud" value={requestId} />
          {form.formError ? (
            <Notice tone="danger" title={form.formError} />
          ) : null}
          <p className="text-body text-muted">{detail}</p>
          <Field
            label={t.anular.motivo}
            name="motivo"
            defaultValue={form.value("motivo")}
            error={form.fieldError("motivo")}
            maxLength={200}
          />
          <SubmitButton pendingText={t.anular.enviando} variant="dangerSolid">
            {t.anular.enviar}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClasses({ variant: "secondary" })}
          >
            {t.anular.volver}
          </button>
        </ActionForm>
      </Sheet>
    </>
  );
}
