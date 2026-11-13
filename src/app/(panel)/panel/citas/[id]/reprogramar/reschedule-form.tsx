"use client";

import { useState } from "react";
import { routes } from "@/lib/routes";
import { rescheduleOwnerAppointmentAction } from "@/modulos/agenda/acciones/owner-appointment";
import { ownerSlotDays } from "@/modulos/agenda/dominio/owner-slots";
import { Card } from "@/ui/card";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { SelectField } from "@/ui/select-field";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { barbersFor, type BookingPayload } from "../../booking-payload";
import { SlotChooser } from "../../slot-chooser";

const t = textos.agenda.reprogramar;

// D-37: the barber (any active one who does every service of the
// appointment), the day and a free time of the same length. The appointment
// does not take its own time, so it can move a quarter of an hour. Without
// "Le avisamos por correo" until there is email (founder, 2026-11-12).
export function RescheduleForm({
  appointmentId,
  summary,
  minutes,
  barberId,
  serviceIds,
  booking,
}: {
  appointmentId: string;
  summary: string;
  minutes: number;
  barberId: string;
  serviceIds: string[];
  booking: BookingPayload;
}) {
  const form = useFormAction(
    rescheduleOwnerAppointmentAction,
    textos.agenda.rechazos,
  );
  const barbers = barbersFor(booking, serviceIds);
  const [barber, setBarber] = useState(
    barbers.some((b) => b.id === barberId) ? barberId : (barbers[0]?.id ?? ""),
  );
  const [slot, setSlot] = useState({ dia: "", hora: "" });
  const chosenBarber = barbers.find((b) => b.id === barber);
  // The React Compiler keeps this from running again on every render.
  const days = chosenBarber
    ? ownerSlotDays({
        now: booking.now,
        barber: chosenBarber,
        durationMinutes: minutes,
        shopHours: booking.shopHours,
        holidayOpenings: booking.holidayOpenings,
        appointments: booking.appointments,
        blocks: booking.blocks,
        exceptAppointmentId: appointmentId,
      })
    : [];
  const close = {
    href: routes.panelAppointment(appointmentId),
    label: textos.ui.cerrar,
  };

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <input type="hidden" name="cita" value={appointmentId} />
      <FlowShell
        header={<TopBar title={t.titulo} titleAs="h1" close={close} />}
        actions={
          <SubmitButton pendingText={t.enviando} disabled={slot.hora === ""}>
            {t.guardar}
          </SubmitButton>
        }
      >
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <Card className="gap-0.5 py-3">
          <span className="text-help text-muted">{t.actual}</span>
          <span className="text-body leading-[1.4] font-semibold">
            {summary}
          </span>
        </Card>
        <SelectField
          label={t.barbero}
          name="barbero"
          value={barber}
          error={form.fieldError("barbero")}
          onChange={(event) => {
            setBarber(event.target.value);
            setSlot({ dia: "", hora: "" });
          }}
          options={barbers.map((b) => ({ value: b.id, label: b.name }))}
        />
        <SlotChooser
          days={days}
          today={booking.today}
          minutes={minutes}
          dia={slot.dia}
          hora={slot.hora}
          onChange={(dia, hora) => setSlot({ dia, hora })}
        />
        {form.fieldError("hora") ? (
          <p className="text-danger text-help">{form.fieldError("hora")}</p>
        ) : null}
      </FlowShell>
    </ActionForm>
  );
}
