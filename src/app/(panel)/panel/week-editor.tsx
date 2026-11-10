"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { formatWallClock } from "@/lib/fechas/fechas";
import {
  DEFAULT_DAY_SHIFT,
  MAX_SHIFTS_PER_DAY,
  TIME_OPTIONS,
  WEEK_DAYS,
  splitShift,
  type DayDraft,
  type DayShift,
  type WeekDraft,
  type Weekday,
} from "@/modulos/barberias/dominio/weekly-hours";
import { Button } from "@/ui/button";
import { WarningIcon } from "@/ui/icons";
import { SelectField } from "@/ui/select-field";
import { Switch } from "@/ui/switch";
import { textos } from "@/ui/textos";

// The week of D-55 (a barber's own hours) and D-58 (the barbershop's): the
// seven days, each with its switch and one or two shifts. The screen owns the
// week and names what the switch means ("Trabaja" or "Abre").

const t = textos.horario;

const TIME_CHOICES = TIME_OPTIONS.map((time) => ({
  value: time,
  label: formatWallClock(time),
}));

export type DayLabels = {
  // The switch's accessible name; on screen it reads as the day alone.
  on: (day: string) => string;
  // Under the day while its switch is off.
  off: string;
};

// React resets a form after its action, which puts every select back on its
// first option and every switch on its default, while the screen's state
// still holds what the owner chose. Layout effects run after that reset, so
// the controls show the state again before the screen paints. Controls opt in
// with data-value (selects) and data-checked (switches).
export function useRestoredControls() {
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
  return controls;
}

export function WeekEditor({
  week,
  labels,
  onChangeDay,
  firstShifts,
  errorOf,
  errorDetailOf,
}: {
  week: WeekDraft;
  labels: DayLabels;
  onChangeDay: (weekday: Weekday, change: (day: DayDraft) => DayDraft) => void;
  // What a day gets when its switch goes on without shifts of its own.
  firstShifts: (weekday: Weekday) => DayShift[];
  errorOf: (weekday: Weekday) => string | undefined;
  // A line after the day's error, such as the barbershop's hours that day.
  errorDetailOf?: (weekday: Weekday) => string | undefined;
}) {
  return (
    <div className="rounded-card border-line flex flex-col overflow-hidden border bg-white">
      {WEEK_DAYS.map((weekday) => (
        <DayEditor
          key={weekday}
          weekday={weekday}
          day={week[weekday]}
          labels={labels}
          firstShifts={firstShifts(weekday)}
          error={errorOf(weekday)}
          errorDetail={errorDetailOf?.(weekday)}
          onChange={(change) => onChangeDay(weekday, change)}
        />
      ))}
    </div>
  );
}

// One day of the week: whether it is on and, if so, one or two shifts.
function DayEditor({
  weekday,
  day,
  labels,
  firstShifts,
  error,
  errorDetail,
  onChange,
}: {
  weekday: Weekday;
  day: DayDraft;
  labels: DayLabels;
  firstShifts: DayShift[];
  error: string | undefined;
  errorDetail: string | undefined;
  onChange: (change: (day: DayDraft) => DayDraft) => void;
}) {
  const id = useId();
  const switchNameId = `${id}-switch`;
  const errorId = `${id}-error`;
  const name = t.dias[weekday]!;
  const shownError = day.works ? error : undefined;

  function setWorks(works: boolean) {
    onChange((current) => ({
      works,
      shifts:
        works && current.shifts.length === 0
          ? firstShifts.length > 0
            ? firstShifts
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

  const split = day.shifts.length > 1;

  return (
    <fieldset className="border-neutral-soft flex min-w-0 flex-col gap-3 border-b px-4 py-3 last:border-b-0">
      {/* The day reads as the switch's label; the group keeps its name. */}
      <legend className="sr-only">{name}</legend>
      <span id={switchNameId} hidden>
        {labels.on(name)}
      </span>
      <Switch
        label={name}
        description={day.works ? undefined : labels.off}
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
                {errorDetail ? ` ${errorDetail}` : null}
              </span>
            </p>
          ) : null}
        </>
      ) : null}
    </fieldset>
  );
}
