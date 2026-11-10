"use client";

import { useState, type ComponentProps } from "react";
import { formatWallClock } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import type { ScheduleState } from "@/modulos/barberias/acciones/barber-schedule";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import {
  dayField,
  draftFromShifts,
  shiftsFromDraft,
  type DayDraft,
  type WeekDraft,
  type Weekday,
} from "@/modulos/barberias/dominio/weekly-hours";
import { FlowShell } from "@/ui/flow-shell";
import { FreshOnReturn } from "@/ui/fresh-on-return";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { Switch } from "@/ui/switch";
import { textos } from "@/ui/textos";
import { useRestoredControls } from "@/ui/restored-controls";
import { TopBar } from "@/ui/top-bar";
import { summarizeHours } from "../configurar/hours-summary";
import { WeekEditor } from "../week-editor";

const t = textos.horario;

const dayLabels = { on: t.trabaja, off: t.descansa };

export type ScheduleBarber = {
  id: string;
  displayName: string;
  usesBarbershopHours: boolean;
  // Their own week; empty while they use the barbershop's.
  shifts: WeeklyShift[];
};

function shopShiftsOf(shop: readonly WeeklyShift[], weekday: Weekday) {
  return draftFromShifts(shop)[weekday].shifts;
}

// Back on this screen after leaving it, the editor starts from what is
// saved, not from a draft that was never saved (FreshOnReturn).
export function ScheduleEditor(
  props: ComponentProps<typeof ScheduleForm>,
) {
  return (
    <FreshOnReturn>
      <ScheduleForm {...props} />
    </FreshOnReturn>
  );
}

// D-55: the barbershop's hours, or the barber's own week with up to two
// shifts a day (decision 8 of task 2.2). The week lives in this screen's
// state and travels as JSON in a hidden field; the server checks it again.
function ScheduleForm({
  action,
  barber,
  shopHours,
}: {
  action: (
    previous: ScheduleState,
    formData: FormData,
  ) => Promise<ScheduleState>;
  barber: ScheduleBarber;
  shopHours: readonly WeeklyShift[];
}) {
  const form = useFormAction(action, t.errores);
  const [usesShop, setUsesShop] = useState(barber.usesBarbershopHours);
  // Null until the owner first turns the switch off: then the week starts as
  // a copy of the barbershop's hours.
  const [week, setWeek] = useState<WeekDraft | null>(() =>
    barber.usesBarbershopHours ? null : draftFromShifts(barber.shifts),
  );
  const shown = !usesShop ? (week ?? draftFromShifts(shopHours)) : null;

  function changeUsesShop(on: boolean) {
    setUsesShop(on);
    if (!on && week === null) setWeek(draftFromShifts(shopHours));
  }

  function changeDay(weekday: Weekday, change: (day: DayDraft) => DayDraft) {
    setWeek((current) => {
      const base = current ?? draftFromShifts(shopHours);
      return { ...base, [weekday]: change(base[weekday]) };
    });
  }

  const shopSummary = summarizeHours(shopHours) || t.barberiaSinHorario;

  const controls = useRestoredControls();

  // After hours_outside_shop, what the barbershop opens that day.
  function shopLine(weekday: Weekday) {
    const shifts = shopShiftsOf(shopHours, weekday);
    return shifts.length > 0
      ? t.barberiaAbre(
          shifts
            .map(
              (s) => `${formatWallClock(s.start)} – ${formatWallClock(s.end)}`,
            )
            .join(", "),
        )
      : t.barberiaCerrada;
  }

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <FlowShell
        header={
          <TopBar
            title={t.titulo(barber.displayName)}
            titleAs="h1"
            back={{
              href: routes.panelBarberEdit(barber.id),
              label: textos.ui.volver,
            }}
          />
        }
        actions={
          <SubmitButton pendingText={t.guardando}>{t.guardar}</SubmitButton>
        }
      >
        <div ref={controls} className="contents">
          <input type="hidden" name="barberId" value={barber.id} />
          <input
            type="hidden"
            name="shifts"
            value={JSON.stringify(shown ? shiftsFromDraft(shown) : [])}
          />
          {form.formError ? (
            <Notice tone="danger" title={form.formError} />
          ) : null}
          <div className="rounded-card border-line border bg-white px-4 py-3">
            <Switch
              label={t.usaBarberia}
              description={shopSummary}
              name="usesBarbershopHours"
              checked={usesShop}
              data-checked={usesShop}
              onChange={(event) => changeUsesShop(event.currentTarget.checked)}
            />
          </div>
          {shown ? (
            <>
              <p className="text-muted text-sm leading-[1.45]">{t.bajada}</p>
              <WeekEditor
                week={shown}
                labels={dayLabels}
                onChangeDay={changeDay}
                firstShifts={(weekday) => shopShiftsOf(shopHours, weekday)}
                errorOf={(weekday) => form.fieldError(dayField(weekday))}
                errorDetailOf={(weekday) =>
                  form.invalidFields?.[dayField(weekday)] ===
                  "hours_outside_shop"
                    ? shopLine(weekday)
                    : undefined
                }
              />
            </>
          ) : null}
        </div>
      </FlowShell>
    </ActionForm>
  );
}
