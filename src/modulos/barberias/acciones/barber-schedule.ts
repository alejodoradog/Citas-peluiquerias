"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import { getBarber, setBarberSchedule } from "../datos/barbers";
import { barbershopNeedsSetup, getBarbershopHours } from "../datos/setup";
import { isId } from "../dominio/service";
import {
  dayField,
  toRpcShifts,
  validateWeek,
  type DayField,
  type WeekErrorCode,
  type Weekday,
} from "../dominio/weekly-hours";

// - hours_*: what is wrong with a day (WeekErrorCode). hours_overlap also
//   comes back as a form error when the database refuses two shifts that
//   overlap, should the check here ever miss one.
// - unknown: anything else, a week the screen could not have sent included.
export type ScheduleActionErrorCode = WeekErrorCode | "unknown";

// Each day's error is keyed by its field ("day1" is Monday). The switch and
// the week are echoed, although the screen keeps its own state.
export type ScheduleField = "usesBarbershopHours" | "shifts" | DayField;

export type ScheduleState = FormState<ScheduleField, ScheduleActionErrorCode>;

// Far above the 14 shifts the screen can send; longer is not parsed at all.
const MAX_WEEK_LENGTH = 4_000;

function readWeek(sent: FormDataEntryValue | null): unknown {
  if (typeof sent !== "string" || sent.length > MAX_WEEK_LENGTH) return null;
  try {
    return JSON.parse(sent);
  } catch {
    return null;
  }
}

// D-55, "Guardar horario". The barber must be one of the owner's barbershop;
// their own hours are checked again here, against the barbershop's hours
// (decision 8 of task 2.2), whatever the screen sent.
export async function saveBarberSchedule(
  _previous: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const { barbershop } = await requireOwner();
  // Before the wizard ends there are no barbershop hours to fit into.
  if (await barbershopNeedsSetup(barbershop.id)) redirect(routes.setup);

  const usesBarbershopHours = formData.get("usesBarbershopHours") === "on";
  const sent = formData.get("shifts");
  const values = {
    usesBarbershopHours: usesBarbershopHours ? "on" : "",
    shifts: typeof sent === "string" ? sent : "",
  };

  const id = formData.get("barberId");
  const barber = isId(id) ? await getBarber(barbershop.id, id) : null;
  if (!barber) return { status: "failed", error: "unknown", values };

  let shifts: ReturnType<typeof toRpcShifts> = [];
  if (!usesBarbershopHours) {
    const week = validateWeek(
      readWeek(sent),
      await getBarbershopHours(barbershop.id),
    );
    if (week.status === "malformed") {
      return { status: "failed", error: "unknown", values };
    }
    if (week.status === "invalid") {
      const entries = Object.entries(week.errors) as Array<
        [string, WeekErrorCode]
      >;
      return {
        status: "invalid",
        fieldErrors: Object.fromEntries(
          entries.map(([weekday, code]) => [
            dayField(Number(weekday) as Weekday),
            code,
          ]),
        ),
        values,
      };
    }
    shifts = toRpcShifts(week.shifts);
  }

  const saved = await setBarberSchedule(barber.id, usesBarbershopHours, shifts);
  if (saved !== "saved") {
    return {
      status: "failed",
      error: saved === "overlap" ? "hours_overlap" : "unknown",
      values,
    };
  }

  revalidatePath(routes.panelBarbers);
  revalidatePath(routes.panelBarberEdit(barber.id));
  revalidatePath(routes.panelBarberSchedule(barber.id));
  redirect(routes.panelBarberEdit(barber.id));
}
