"use client";

import { useEffect } from "react";
import { routes } from "@/lib/routes";
import type { NewBarbershopState } from "@/modulos/barberias/acciones/barbershops";
import { Field } from "@/ui/field";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";

const t = textos.sedes.nuevaSede;

function fullPageLoad(path: string) {
  window.location.assign(path);
}

// Task 2.6, "Nueva sede": its name and an optional WhatsApp, and what the
// company trial means for it (spec, P7). requestId is made by the server
// once per visit, so a second tap, or the form sent again, gives back the
// sede the first one created. Once created, the new sede is the active one
// and its setup wizard loads in full: a client navigation would leave hidden
// pages mounted with the other sede's data (lesson of PR #30).
export function NewBarbershopForm({
  action,
  requestId,
  trial,
  goTo = fullPageLoad,
}: {
  action: (
    previous: NewBarbershopState,
    formData: FormData,
  ) => Promise<NewBarbershopState>;
  requestId: string;
  // The last day of the company trial, as a day in Bogotá, and whether it
  // already ended.
  trial: { until: string; ended: boolean };
  // Where a created sede lands; a full page load, replaced in tests.
  goTo?: (path: string) => void;
}) {
  const form = useFormAction(action, t.errores);
  const created = form.notice === "created";

  useEffect(() => {
    if (created) goTo(routes.setup);
  }, [created, goTo]);

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <FlowShell
        header={
          <TopBar
            title={t.titulo}
            titleAs="h1"
            back={{ href: routes.panelMore, label: textos.ui.volver }}
          />
        }
        actions={
          <SubmitButton pendingText={t.creando} disabled={created}>
            {created ? t.creando : t.crear}
          </SubmitButton>
        }
      >
        <input type="hidden" name="requestId" value={requestId} />
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <p className="text-body text-muted">{t.bajada}</p>
        <Field
          label={t.campos.nombre}
          name="name"
          defaultValue={form.value("name") ?? ""}
          help={t.ayudas.nombre}
          error={form.fieldError("name")}
          autoComplete="organization"
        />
        <Field
          label={t.campos.whatsapp}
          name="whatsappPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          optional
          defaultValue={form.value("whatsappPhone") ?? ""}
          help={t.ayudas.whatsapp}
          error={form.fieldError("whatsappPhone")}
        />
        {trial.ended ? (
          <Notice tone="warning" title={t.pruebaVencida}>
            {t.pruebaVencidaDetalle(trial.until)}
          </Notice>
        ) : (
          <Notice tone="info" title={t.prueba}>
            {t.pruebaHasta(trial.until)}
          </Notice>
        )}
      </FlowShell>
    </ActionForm>
  );
}
