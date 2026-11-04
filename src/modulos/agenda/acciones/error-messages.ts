import { textos } from "@/ui/textos";
import type { AppointmentWriteError } from "../datos/appointment-errors";

const messages: Record<AppointmentWriteError, string> = {
  slot_taken: textos.agenda.errores.horaTomada,
  unknown: textos.agenda.errores.desconocido,
};

export function appointmentErrorMessage(error: AppointmentWriteError): string {
  return messages[error];
}
