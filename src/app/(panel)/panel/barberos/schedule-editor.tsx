"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { formatWallClock } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import type { ScheduleState } from "@/modulos/barberias/acciones/barber-schedule";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import {
  DEFAULT_DAY_SHIFT,
  MAX_SHIFTS_PER_DAY,
  TIME_OPTIONS,
  WEEK_DAYS,
  dayField,
  draftFromShifts,
  shiftsFromDraft,
  splitShift,
  type DayDraft,
  type DayShift,
  type WeekDraft,
  type Weekday,
} from "@/modulos/barberias/dominio/weekly-hours";
import { Button } from "@/ui/button";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { WarningIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { SelectField } from "@/ui/select-field";
import { Switch } from "@/ui/switch";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { summarizeHours } from "../configurar/hours-summary";

const t = textos.horario;

const TIME_CHOICES = TIME_OPTIONS.map((time) => ({
  value: time,
  label: formatWallClock(time),
}));

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

// D-55: the barbershop's hours, or the barber's own week with up to two
// shifts a day (decision 8 of task 2.2). The week lives in this screen's
// state and travels as JSON in a hidden field; the server checks it again.
export function ScheduleEditor({
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

  // React resets the form after its action, which puts every select back on
  // its first option and every switch on its default, while the state still
  // holds what the owner chose. Layout effects run after that reset, so the
  // controls show the state again before the screen paints.
  const controls = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = controls.current;
    if (!root) return;
    for (const select of root.querySelectorAll<HTMLSelectElement>(
      "select[data-value]",
    )) {
      if (select.value !== select.dataset.value) {
        select.value = select.dataset.value!;
      }
    }
    for (const box of root.querySelectorAll<HTMLInputElement>(
      "input[data-checked]",
    )) {
      box.checked = box.dataset.checked === "true";
    }
  });

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
              <p className="text-help text-muted leading-[1.45]">{t.bajada}</p>
              <div className="rounded-card border-line flex flex-col overflow-hidden border bg-white">
                {WEEK_DAYS.map((weekday) => (
                  <DayEditor
                    key={weekday}
                    weekday={weekday}
                    day={shown[weekday]}
                    shopShifts={shopShiftsOf(shopHours, weekday)}
                    error={form.fieldError(dayField(weekday))}
                    showShopHours={
                      form.invalidFields?.[dayField(weekday)] ===
                      "hours_outside_shop"
                    }
                    onChange={(change) => changeDay(weekday, change)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </FlowShell>
    </ActionForm>
  );
}

// One day of the week: whether they work and, if so, one or two shifts.
function DayEditor({
  weekday,
  day,
  shopShifts,
  error,
  showShopHours,
  onChange,
}: {
  weekday: Weekday;
  day: DayDraft;
  shopShifts: DayShift[];
  error: string | undefined;
  showShopHours: boolean;
  onChange: (change: (day: DayDraft) => DayDraft) => void;
}) {
  const id = useId();
  const switchNameId = `${id}-trabaja`;
  const errorId = `${id}-error`;
  const name = t.dias[weekday]!;
  const shownError = day.works ? error : undefined;

  function setWorks(works: boolean) {
    onChange((current) => ({
      works,
      // A day that starts working takes the barbershop's hours of that day.
      shifts:
        works && current.shifts.length === 0
          ? shopShifts.length > 0
            ? shopShifts
            : [DEFAULT_DAY_SHIFT]
          : current.shifts,
    }));
  }

  function setTime(index: number, edge: keyof DayShift, time: string) {
    onChange((current) => ({
      ...current,
      shifts: current.shifts.map((shift, i) =>
        i === index ? { ...shift, [edge]: time } : shift,
      ),
    }));
  }

  const shopLine =
    shopShifts.length > 0
      ? t.barberiaAbre(
          shopShifts
            .map(
              (s) => `${formatWallClock(s.start)} – ${formatWallClock(s.end)}`,
            )
            .join(", "),
        )
      : t.barberiaCerrada;

  const split = day.shifts.length > 1;

  return (
    <fieldset className="border-neutral-soft flex min-w-0 flex-col gap-3 border-b px-4 py-3 last:border-b-0">
      {/* The day reads as the switch's label; the group keeps its name. */}
      <legend className="sr-only">{name}</legend>
      <span id={switchNameId} hidden>
        {t.trabaja(name)}
      </span>
      <Switch
        label={name}
        description={day.works ? undefined : t.descansa}
        checked={day.works}
        data-checked={day.works}
        onChange={(event) => setWorks(event.currentTarget.checked)}
        aria-labelledby={switchNameId}
      />
      {day.works ? (
        <>
          {day.shifts.map((shift, index) => (
            <div
              key={index}
              role={split ? "group" : undefined}
              aria-label={split ? t.tramos[index] : undefined}
              className="flex flex-col gap-2"
            >
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label={t.desde}
                  name={`desde-${weekday}-${index}`}
                  options={TIME_CHOICES}
                  value={shift.start}
                  data-value={shift.start}
                  onChange={(event) =>
                    setTime(index, "start", event.currentTarget.value)
                  }
                  aria-invalid={shownError ? true : undefined}
                  aria-describedby={shownError ? errorId : undefined}
                />
                <SelectField
                  label={t.hasta}
                  name={`hasta-${weekday}-${index}`}
                  options={TIME_CHOICES}
                  value={shift.end}
                  data-value={shift.end}
                  onChange={(event) =>
                    setTime(index, "end", event.currentTarget.value)
                  }
                  aria-invalid={shownError ? true : undefined}
                  aria-describedby={shownError ? errorId : undefined}
                />
              </div>
              {index > 0 ? (
                <Button
                  variant="text"
                  size="sm"
                  block={false}
                  className="self-start"
                  aria-label={t.quitarDia(name)}
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      shifts: current.shifts.slice(0, index),
                    }))
                  }
                >
                  {t.quitar}
                </Button>
              ) : null}
            </div>
          ))}
          {day.shifts.length < MAX_SHIFTS_PER_DAY && day.shifts[0] ? (
            <Button
              variant="secondary"
              size="sm"
              block={false}
              className="self-start"
              aria-label={t.partirDia(name)}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  shifts: current.shifts[0]
                    ? splitShift(current.shifts[0])
                    : current.shifts,
                }))
              }
            >
              {t.partir}
            </Button>
          ) : null}
          {shownError ? (
            <p
              id={errorId}
              className="text-help text-danger flex items-start gap-1.5"
            >
              <span className="flex pt-px">
                <WarningIcon size={16} />
              </span>
              <span>
                {shownError}
                {showShopHours ? ` ${shopLine}` : null}
              </span>
            </p>
          ) : null}
        </>
      ) : null}
    </fieldset>
  );
}
