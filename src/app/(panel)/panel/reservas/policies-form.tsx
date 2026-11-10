"use client";

import { useState } from "react";
import { routes } from "@/lib/routes";
import type { PoliciesState } from "@/modulos/barberias/acciones/policies";
import {
  BOOKING_WINDOW_DAYS,
  CANCELLATION_NOTICE_OPTIONS,
  MIN_BOOKING_NOTICE_OPTIONS,
  optionsWith,
  type Policies,
} from "@/modulos/barberias/dominio/policies";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { SelectField } from "@/ui/select-field";
import { textos } from "@/ui/textos";
import { useRestoredControls } from "@/ui/restored-controls";
import { TopBar } from "@/ui/top-bar";

const t = textos.politicas;

// D-60: how close to the time customers may book, and until when they may
// cancel or move their appointment from the email link. How far ahead they
// book is fixed (30 days). Native selects instead of the design's sheet, as
// in the rest of the panel.
export function PoliciesForm({
  action,
  saved,
}: {
  action: (
    previous: PoliciesState,
    formData: FormData,
  ) => Promise<PoliciesState>;
  saved: Policies;
}) {
  const form = useFormAction(action, t.errores);
  // Controlled, and put back after React resets the form following its
  // action, so a refused save keeps what the owner chose.
  const [notice, setNotice] = useState(String(saved.minBookingNoticeMinutes));
  const [cancel, setCancel] = useState(String(saved.cancellationNoticeHours));
  const controls = useRestoredControls();

  const noticeOptions = optionsWith(
    MIN_BOOKING_NOTICE_OPTIONS,
    saved.minBookingNoticeMinutes,
  ).map((minutes) => ({
    value: String(minutes),
    label: t.anticipacionOpcion(minutes),
  }));
  const cancelOptions = optionsWith(
    CANCELLATION_NOTICE_OPTIONS,
    saved.cancellationNoticeHours,
  ).map((hours) => ({
    value: String(hours),
    label: t.cancelarOpcion(hours),
  }));

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
          <SubmitButton pendingText={t.guardando}>{t.guardar}</SubmitButton>
        }
      >
        <div ref={controls} className="contents">
          {form.formError ? (
            <Notice tone="danger" title={form.formError} />
          ) : null}
          <SelectField
            label={t.anticipacion}
            name="minBookingNotice"
            options={noticeOptions}
            help={t.anticipacionAyuda}
            error={form.fieldError("minBookingNotice")}
            value={notice}
            data-value={notice}
            onChange={(event) => setNotice(event.currentTarget.value)}
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-help text-muted">{t.ventana}</span>
            <span className="text-body leading-[1.4] font-semibold">
              {t.ventanaValor(BOOKING_WINDOW_DAYS)}
            </span>
          </div>
          <SelectField
            label={t.cancelar}
            name="cancellationNotice"
            options={cancelOptions}
            help={t.cancelarAyuda}
            error={form.fieldError("cancellationNotice")}
            value={cancel}
            data-value={cancel}
            onChange={(event) => setCancel(event.currentTarget.value)}
          />
          <Notice tone="info" title={t.siempre}>
            {t.siempreDetalle}
          </Notice>
        </div>
      </FlowShell>
    </ActionForm>
  );
}
