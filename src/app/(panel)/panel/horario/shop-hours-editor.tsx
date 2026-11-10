"use client";

import Link from "next/link";
import { Fragment, useState, type ComponentProps } from "react";
import { routes } from "@/lib/routes";
import type { ShopHoursState } from "@/modulos/barberias/acciones/shop-hours";
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
import { CalendarIcon } from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { useRestoredControls } from "@/ui/restored-controls";
import { TopBar } from "@/ui/top-bar";
import { WeekEditor } from "../week-editor";

const t = textos.horarioBarberia;

const dayLabels = { on: t.abre, off: t.cerrado };

// A day that opens takes 9:00 a. m. – 6:00 p. m. (DEFAULT_DAY_SHIFT).
const noShifts = () => [];

export type OutsideBarber = { id: string; displayName: string };

// Back on this screen after leaving it, the editor starts from what is
// saved, not from a draft that was never saved (FreshOnReturn).
export function ShopHoursEditor(
  props: ComponentProps<typeof ShopHoursForm>,
) {
  return (
    <FreshOnReturn>
      <ShopHoursForm {...props} />
    </FreshOnReturn>
  );
}

// D-58: the barbershop's week, each day open or closed with one or two
// shifts, the same editor as a barber's own hours (D-55). The week travels as
// JSON in a hidden field; the server checks it again and the database refuses
// a week without open days or with shifts that overlap.
function ShopHoursForm({
  action,
  hours,
  saved,
  outside,
}: {
  action: (
    previous: ShopHoursState,
    formData: FormData,
  ) => Promise<ShopHoursState>;
  hours: readonly WeeklyShift[];
  // Back from "Guardar horario".
  saved: boolean;
  // Barbers whose own hours go beyond these: theirs are not cut.
  outside: readonly OutsideBarber[];
}) {
  const form = useFormAction(action, t.errores);
  const [week, setWeek] = useState<WeekDraft>(() => draftFromShifts(hours));
  const controls = useRestoredControls();

  function changeDay(weekday: Weekday, change: (day: DayDraft) => DayDraft) {
    setWeek((current) => ({ ...current, [weekday]: change(current[weekday]) }));
  }

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
          <input
            type="hidden"
            name="shifts"
            value={JSON.stringify(shiftsFromDraft(week))}
          />
          {form.formError ? (
            <Notice tone="danger" title={form.formError} />
          ) : saved ? (
            <Notice tone="success" title={t.guardado} />
          ) : null}
          {outside.length > 0 ? (
            <Notice
              tone="warning"
              title={t.fuera(outside.map((barber) => barber.displayName))}
            >
              {t.fueraDetalle}{" "}
              {outside.map((barber, index) => (
                <Fragment key={barber.id}>
                  {index > 0 ? " · " : null}
                  <Link
                    href={routes.panelBarberSchedule(barber.id)}
                    className="text-brand-strong font-semibold underline"
                  >
                    {textos.horario.titulo(barber.displayName)}
                  </Link>
                </Fragment>
              ))}
            </Notice>
          ) : null}
          <p className="text-muted text-sm leading-[1.45]">{t.bajada}</p>
          <WeekEditor
            week={week}
            labels={dayLabels}
            onChangeDay={changeDay}
            firstShifts={noShifts}
            errorOf={(weekday) => form.fieldError(dayField(weekday))}
          />
          <List>
            <ListRow
              icon={<CalendarIcon />}
              title={t.festivos}
              subtitle={t.festivosDetalle}
              href={routes.panelHolidays}
            />
          </List>
        </div>
      </FlowShell>
    </ActionForm>
  );
}
