import { routes } from "@/lib/routes";
import type { DayAvailability } from "@/modulos/agenda/dominio/availability";
import type { ManageSelection } from "@/modulos/agenda/dominio/manage-flow";
import { toDayTimes } from "../../[slug]/reservar/slot-days";
import { RescheduleChooser } from "./reschedule-chooser";

// C-10 "Cambiar día u hora": the free times of the same barber for an
// appointment of the same length (loadRescheduleAvailability). The server
// sends those of the whole window once; as in C-04, the day and the time
// are chosen in the browser (reschedule-chooser.tsx), and "Cambiar mi cita"
// moves it, checked again by the database.
export function RescheduleStep({
  token,
  days,
  today,
  selection,
  current,
  summary,
  barberName,
  priceCop,
}: {
  token: string;
  days: DayAvailability[];
  today: string;
  selection: ManageSelection;
  // Where the appointment is now, in Bogotá.
  current: { date: string; time: string };
  summary: string;
  barberName: string;
  priceCop: number;
}) {
  return (
    <RescheduleChooser
      token={token}
      backHref={routes.manageAppointment(token)}
      days={toDayTimes(days)}
      today={today}
      date={selection.date}
      time={selection.time}
      taken={selection.taken}
      current={current}
      summary={summary}
      barberName={barberName}
      priceCop={priceCop}
    />
  );
}
