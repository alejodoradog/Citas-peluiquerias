"use client";

import { useState } from "react";
import {
  extendTrial,
  reactivateBarbershop,
  suspendBarbershop,
  voidPayment,
} from "@/modulos/suscripciones/acciones/platform";
import { EXTEND_DAYS } from "@/modulos/suscripciones/dominio/platform-forms";
import { buttonClasses } from "@/ui/button";
import { Field } from "@/ui/field";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { SelectField } from "@/ui/select-field";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.plataforma;

// The buttons under P-02 and their sheets: "Extender prueba" (P-04, only
// during the trial) and "Suspender" (P-05), or "Reactivar" when suspended
// (decision P5).
export function FichaActions({
  barbershopId,
  name,
  inTrial,
  suspended,
  trialEndsLabel,
  extendOptions,
}: {
  barbershopId: string;
  name: string;
  inTrial: boolean;
  suspended: boolean;
  trialEndsLabel: string;
  extendOptions: { days: number; until: string }[];
}) {
  const [open, setOpen] = useState<"extend" | "suspend" | "reactivate" | null>(
    null,
  );
  const close = () => setOpen(null);

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {inTrial ? (
        <button
          type="button"
          onClick={() => setOpen("extend")}
          className={buttonClasses({ variant: "secondary", size: "md" })}
        >
          {t.ficha.extender}
        </button>
      ) : null}
      {suspended ? (
        <button
          type="button"
          onClick={() => setOpen("reactivate")}
          className={buttonClasses({ variant: "secondary", size: "md" })}
        >
          {t.ficha.reactivar}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen("suspend")}
          className={buttonClasses({ variant: "danger", size: "md" })}
        >
          {t.ficha.suspender}
        </button>
      )}

      <Sheet open={open === "extend"} onClose={close} title={t.extender.titulo}>
        <ExtendForm
          barbershopId={barbershopId}
          trialEndsLabel={trialEndsLabel}
          options={extendOptions}
        />
      </Sheet>
      <Sheet
        open={open === "suspend"}
        onClose={close}
        title={t.suspender.titulo(name)}
      >
        <ConfirmForm
          action={suspendBarbershop}
          barbershopId={barbershopId}
          detail={t.suspender.detalle}
          note={
            <Notice tone="info" title={t.suspender.avisoTitulo}>
              {t.suspender.aviso}
            </Notice>
          }
          submit={t.suspender.enviar}
          pending={t.suspender.enviando}
          danger
          onBack={close}
          back={t.suspender.volver}
        />
      </Sheet>
      <Sheet
        open={open === "reactivate"}
        onClose={close}
        title={t.reactivar.titulo(name)}
      >
        <ConfirmForm
          action={reactivateBarbershop}
          barbershopId={barbershopId}
          detail={t.reactivar.detalle}
          submit={t.reactivar.enviar}
          pending={t.reactivar.enviando}
          onBack={close}
          back={t.reactivar.volver}
        />
      </Sheet>
    </div>
  );
}

type ConfirmAction = typeof suspendBarbershop;

function ConfirmForm({
  action,
  barbershopId,
  detail,
  note,
  submit,
  pending,
  danger = false,
  onBack,
  back,
}: {
  action: ConfirmAction;
  barbershopId: string;
  detail: string;
  note?: React.ReactNode;
  submit: string;
  pending: string;
  danger?: boolean;
  onBack: () => void;
  back: string;
}) {
  const form = useFormAction(action, t.errores);
  return (
    <ActionForm form={form} className="flex flex-col gap-3.5">
      <input type="hidden" name="barberia" value={barbershopId} />
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <p className="text-body text-muted">{detail}</p>
      {note}
      <SubmitButton
        pendingText={pending}
        variant={danger ? "dangerSolid" : "primary"}
      >
        {submit}
      </SubmitButton>
      <button
        type="button"
        onClick={onBack}
        className={buttonClasses({ variant: "secondary" })}
      >
        {back}
      </button>
    </ActionForm>
  );
}

// P-04: "Días extra" and the new date it gives.
function ExtendForm({
  barbershopId,
  trialEndsLabel,
  options,
}: {
  barbershopId: string;
  trialEndsLabel: string;
  options: { days: number; until: string }[];
}) {
  const form = useFormAction(extendTrial, t.errores);
  const [days, setDays] = useState(String(EXTEND_DAYS[1]));
  const until = options.find((option) => String(option.days) === days)?.until;
  return (
    <ActionForm form={form} className="flex flex-col gap-3.5">
      <input type="hidden" name="barberia" value={barbershopId} />
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <p className="text-muted text-sm">
        {t.extender.pruebaHasta}:{" "}
        <strong className="text-ink">{trialEndsLabel}</strong>
      </p>
      <SelectField
        label={t.extender.dias}
        name="dias"
        value={days}
        onChange={(event) => setDays(event.target.value)}
        options={options.map((option) => ({
          value: String(option.days),
          label: t.extender.diasOpcion(option.days),
        }))}
        error={form.fieldError("dias")}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-muted text-[13px]">{t.extender.nuevaFecha}</span>
        <strong className="text-[15px]">{until}</strong>
      </div>
      <SubmitButton pendingText={t.extender.enviando}>
        {t.extender.enviar}
      </SubmitButton>
    </ActionForm>
  );
}

// Decision P4: "Anular" on a payment of P-02, with its reason.
export function VoidPaymentButton({
  barbershopId,
  paymentId,
  label,
  detail,
}: {
  barbershopId: string;
  paymentId: string;
  label: string;
  detail: string;
}) {
  const [open, setOpen] = useState(false);
  const form = useFormAction(voidPayment, t.errores);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className="text-danger min-h-11 shrink-0 px-2 text-[13px] font-semibold"
      >
        {t.ficha.anular}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.anular.titulo}>
        <ActionForm form={form} className="flex flex-col gap-3.5">
          <input type="hidden" name="barberia" value={barbershopId} />
          <input type="hidden" name="pago" value={paymentId} />
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
