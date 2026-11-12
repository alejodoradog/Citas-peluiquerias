"use client";

import { rescheduleAppointment } from "@/modulos/agenda/acciones/manage";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";

const t = textos.reservas.gestionar;

// "Cambiar mi cita" of C-10, held back until a time is chosen.
export function RescheduleForm({
  token,
  date,
  time,
}: {
  token: string;
  date: string;
  time: string | null;
}) {
  const form = useFormAction(rescheduleAppointment, t.errores);
  return (
    <ActionForm form={form} className="flex flex-col gap-2.5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="dia" value={date} />
      <input type="hidden" name="hora" value={time ?? ""} />
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <SubmitButton
        pendingText={t.reprogramar.cambiando}
        disabled={time === null}
      >
        {t.reprogramar.boton}
      </SubmitButton>
    </ActionForm>
  );
}
