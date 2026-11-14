"use client";

import { useState } from "react";
import { registerPayment } from "@/modulos/suscripciones/acciones/platform";
import { Field } from "@/ui/field";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { SelectField, type SelectOption } from "@/ui/select-field";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";

const t = textos.plataforma.pago;

// P-03: the form wraps the whole screen so "Registrar y activar" sits in the
// bottom bar. The value and the period are the plan's (decision P1): shown,
// never typed.
export function PaymentForm({
  barbershopId,
  barbershopName,
  close,
  amount,
  methods,
  days,
}: {
  barbershopId: string;
  barbershopName: string;
  close: string;
  amount: string;
  methods: SelectOption[];
  days: { value: string; label: string; until: string; explanation: string }[];
}) {
  const form = useFormAction(registerPayment, textos.plataforma.errores);
  const [day, setDay] = useState(form.value("fecha") ?? days[0]!.value);
  const chosen = days.find((option) => option.value === day) ?? days[0]!;

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <input type="hidden" name="barberia" value={barbershopId} />
      <FlowShell
        header={
          <TopBar
            title={t.titulo}
            titleAs="h1"
            subtitle={barbershopName}
            close={{ href: close, label: t.cerrar }}
          />
        }
        actions={
          <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
        }
      >
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <Field label={t.valor} name="valor" value={amount} readOnly />
        <Field
          label={t.periodo}
          name="periodo"
          value={t.unMes}
          help={t.ayudaPeriodo}
          readOnly
        />
        <SelectField
          label={t.medio}
          name="metodo"
          options={methods}
          defaultValue={form.value("metodo") ?? methods[0]?.value}
          error={form.fieldError("metodo")}
        />
        <Field
          label={t.referencia}
          name="referencia"
          defaultValue={form.value("referencia")}
          error={form.fieldError("referencia")}
          maxLength={100}
          autoComplete="off"
        />
        <SelectField
          label={t.fecha}
          name="fecha"
          options={days}
          value={day}
          onChange={(event) => setDay(event.target.value)}
          error={form.fieldError("fecha")}
        />
        <div
          aria-live="polite"
          className="border-line flex flex-col gap-1 rounded-2xl border bg-white px-4 py-3.5"
        >
          <span className="text-muted text-[13px]">{t.quedaHasta}</span>
          <strong className="text-base">{chosen.until}</strong>
          <span className="text-muted text-[13px]">{chosen.explanation}</span>
        </div>
      </FlowShell>
    </ActionForm>
  );
}
