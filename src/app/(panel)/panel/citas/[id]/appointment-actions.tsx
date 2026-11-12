"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { routes } from "@/lib/routes";
import {
  cancelOwnerAppointment,
  changeAppointmentServices,
  markAppointment,
} from "@/modulos/agenda/acciones/owner-appointment";
import type { AppointmentActions } from "@/modulos/agenda/dominio/owner-slots";
import { Button, buttonClasses } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { cx } from "@/ui/cx";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { CheckIcon, CircleCheckIcon, EditIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.agenda;

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCop: number;
};

// The bottom bar of D-34: "Atendida" and "No asistió" once the appointment
// started (both open D-35), "Reprogramar" (D-37) and "Cancelar cita" (D-36)
// while it is confirmed.
export function AppointmentActionBar({
  appointmentId,
  customerName,
  when,
  actions,
}: {
  appointmentId: string;
  customerName: string;
  // "hoy 10:40 a. m."
  when: string;
  actions: AppointmentActions;
}) {
  const [sheet, setSheet] = useState<"mark" | "cancel" | null>(null);
  const close = () => setSheet(null);
  const row = "grid grid-cols-2 gap-2.5";

  return (
    <>
      {actions.mark ? (
        <div className={row}>
          <Button size="md" onClick={() => setSheet("mark")}>
            <CheckIcon size={18} />
            {t.detalleCita.atendida}
          </Button>
          <Button
            size="md"
            variant="secondary"
            onClick={() => setSheet("mark")}
          >
            {t.detalleCita.noAsistio}
          </Button>
        </div>
      ) : null}
      {actions.cancel ? (
        <div className={row}>
          <Link
            href={routes.panelAppointmentReschedule(appointmentId)}
            className={buttonClasses({ variant: "secondary", size: "md" })}
          >
            {t.detalleCita.reprogramar}
          </Link>
          <Button size="md" variant="danger" onClick={() => setSheet("cancel")}>
            {t.detalleCita.cancelar}
          </Button>
        </div>
      ) : null}

      <Sheet open={sheet === "mark"} onClose={close} title={t.marcar.titulo}>
        {sheet === "mark" ? <MarkForm appointmentId={appointmentId} /> : null}
      </Sheet>
      <Sheet
        open={sheet === "cancel"}
        onClose={close}
        title={t.cancelar.titulo}
      >
        {sheet === "cancel" ? (
          <CancelForm
            appointmentId={appointmentId}
            body={t.cancelar.cuerpo(customerName, when)}
            onBack={close}
          />
        ) : null}
      </Sheet>
    </>
  );
}

// D-35: two big choices, each a submit of its own.
function MarkForm({ appointmentId }: { appointmentId: string }) {
  const form = useFormAction(markAppointment, t.rechazos);
  const choice =
    "flex min-h-13.5 w-full items-center gap-3 rounded-button px-4 text-base font-bold";
  return (
    <ActionForm form={form} className="flex flex-col gap-3.5">
      <input type="hidden" name="cita" value={appointmentId} />
      <p className="text-body text-muted">{t.marcar.cuerpo}</p>
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <button
        type="submit"
        name="estado"
        value="attended"
        className={cx(
          choice,
          "border-success bg-success-soft text-success border-2",
        )}
      >
        <CircleCheckIcon size={22} />
        {t.detalleCita.atendida}
      </button>
      <button
        type="submit"
        name="estado"
        value="no_show"
        className={cx(choice, "border-line text-danger border bg-white")}
      >
        {t.detalleCita.noAsistio}
      </button>
      <p className="text-help text-muted">{t.marcar.nota}</p>
    </ActionForm>
  );
}

// D-36, without the message to the customer: there is no email yet
// (founder, 2026-11-12; it arrives in phase 5).
function CancelForm({
  appointmentId,
  body,
  onBack,
}: {
  appointmentId: string;
  body: string;
  onBack: () => void;
}) {
  const form = useFormAction(cancelOwnerAppointment, t.rechazos);
  return (
    <ActionForm form={form} className="flex flex-col gap-3.5">
      <input type="hidden" name="cita" value={appointmentId} />
      <p className="text-body text-muted">{body}</p>
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <SubmitButton pendingText={t.cancelar.enviando} variant="dangerSolid">
        {t.cancelar.confirmar}
      </SubmitButton>
      <Button variant="secondary" onClick={onBack}>
        {t.cancelar.volver}
      </Button>
    </ActionForm>
  );
}

// The pencil of D-34: the services of the appointment, with the checkboxes
// of D-38 and the new length and price (founder, 2026-11-12).
export function EditServicesButton({
  appointmentId,
  options,
  chosen,
}: {
  appointmentId: string;
  // The appointment's services, then the other active ones the barber
  // offers.
  options: readonly Service[];
  // The lines of the appointment, with the price and length they keep.
  chosen: readonly Service[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t.detalleCita.editar}
        onClick={() => setOpen(true)}
        className="text-ink flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <EditIcon size={20} />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t.servicios.titulo}
      >
        {open ? (
          <ServicesForm
            appointmentId={appointmentId}
            options={options}
            chosen={chosen}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function ServicesForm({
  appointmentId,
  options,
  chosen,
}: {
  appointmentId: string;
  options: readonly Service[];
  chosen: readonly Service[];
}) {
  const form = useFormAction(changeAppointmentServices, t.rechazos);
  const [ids, setIds] = useState<string[]>(() => chosen.map((s) => s.id));
  // A line the appointment keeps keeps its price; a new one takes today's.
  const lines = ids.map(
    (id) =>
      chosen.find((s) => s.id === id) ?? options.find((s) => s.id === id)!,
  );
  const minutes = lines.reduce((sum, s) => sum + s.durationMinutes, 0);
  const price = lines.reduce((sum, s) => sum + s.priceCop, 0);

  return (
    <ActionForm form={form} className="flex flex-col gap-3.5">
      <input type="hidden" name="cita" value={appointmentId} />
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <div className="rounded-card border-line flex flex-col border bg-white px-4 py-2">
        {options.map((service) => {
          const kept = chosen.find((s) => s.id === service.id) ?? service;
          return (
            <Checkbox
              key={service.id}
              name="servicios"
              value={service.id}
              label={service.name}
              description={t.servicios.detalle(
                kept.durationMinutes,
                formatPesos(kept.priceCop),
              )}
              checked={ids.includes(service.id)}
              onChange={(event) =>
                setIds((current) =>
                  event.target.checked
                    ? [...current, service.id]
                    : current.filter((id) => id !== service.id),
                )
              }
            />
          );
        })}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body text-muted">
          {t.nueva.total(ids.length, minutes)}
        </span>
        <strong className="text-[1.0625rem] whitespace-nowrap">
          {formatPesos(price)}
        </strong>
      </div>
      <SubmitButton
        pendingText={t.servicios.enviando}
        disabled={ids.length === 0}
      >
        {t.servicios.guardar}
      </SubmitButton>
    </ActionForm>
  );
}
