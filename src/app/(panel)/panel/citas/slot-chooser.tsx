"use client";

import {
  formatShortWallClock,
  formatWallClock,
  toBogotaTime,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import type { DayAvailability } from "@/modulos/agenda/dominio/availability";
import { cx } from "@/ui/cx";
import { SelectField } from "@/ui/select-field";
import { textos } from "@/ui/textos";
import { dayTitle } from "../agenda-labels";

const t = textos.agenda.reprogramar;

// The day and the free time of D-37 and D-38 (task 4.2): a native select
// with the days that have a free time, and the free times of the chosen day
// as a group of radio buttons, 4 to a row, as D-37 draws them. They post
// "dia" (YYYY-MM-DD) and "hora" (HH:MM) with the form around them.
export function SlotChooser({
  days,
  today,
  minutes,
  dia,
  hora,
  onChange,
  named = true,
}: {
  days: readonly DayAvailability[];
  today: BogotaDate;
  minutes: number;
  dia: string;
  hora: string;
  onChange: (dia: string, hora: string) => void;
  // False when the form posts the choice from fields of its own (D-38,
  // where the chooser lives in a sheet).
  named?: boolean;
}) {
  const open = days.filter((day) => day.slots.length > 0);
  const chosen = open.find((day) => day.date === dia) ?? open[0];

  return (
    <>
      {open.length > 0 ? (
        <SelectField
          label={t.dia}
          name={named ? "dia" : "dia-elegido"}
          value={chosen?.date ?? ""}
          onChange={(event) => onChange(event.target.value, "")}
          options={open.map((day) => ({
            value: day.date,
            label: dayTitle(day.date, today),
          }))}
        />
      ) : null}
      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-muted mb-2.5 text-sm font-semibold">
          {t.horas(minutes)}
        </legend>
        {chosen ? (
          <div className="grid grid-cols-4 gap-2">
            {chosen.slots.map((slot) => {
              const time = toBogotaTime(slot.start);
              const full = formatWallClock(time);
              const short = formatShortWallClock(time);
              return (
                <label
                  key={time}
                  className={cx(
                    "border-line text-ink flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border bg-white text-[15px] font-bold",
                    "has-checked:border-brand has-checked:bg-brand has-checked:border-2 has-checked:text-white",
                    "has-focus-visible:outline-brand-strong has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
                  )}
                >
                  <input
                    type="radio"
                    name={named ? "hora" : "hora-elegida"}
                    value={time}
                    checked={chosen.date === dia && hora === time}
                    onChange={() => onChange(chosen.date, time)}
                    className="sr-only"
                  />
                  {short}
                  <span className="sr-only">{full.slice(short.length)}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-body text-muted">{t.sinHoras}</p>
        )}
      </fieldset>
    </>
  );
}
