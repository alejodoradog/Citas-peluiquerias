"use client";

import {
  useEffect,
  useState,
  useTransition,
  type ComponentProps,
} from "react";
import { formatWallClock } from "@/lib/fechas/fechas";
import type { Holiday } from "@/lib/fechas/festivos";
import { routes } from "@/lib/routes";
import type {
  ClosureCommandResult,
  ClosureState,
  HolidaysState,
} from "@/modulos/barberias/acciones/holidays";
import {
  CLOSURE_END_TIMES,
  CLOSURE_START_TIMES,
  END_OF_DAY,
  MAX_REASON_LENGTH,
} from "@/modulos/barberias/dominio/closures";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { FlowShell } from "@/ui/flow-shell";
import { FreshOnReturn } from "@/ui/fresh-on-return";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { CalendarIcon, PlusIcon, TrashIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { useRestoredControls } from "@/ui/restored-controls";
import { SelectField } from "@/ui/select-field";
import { Sheet } from "@/ui/sheet";
import { EmptyState } from "@/ui/states";
import { Switch } from "@/ui/switch";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { holidayDay, holidayNames } from "./closure-text";

const t = textos.festivos;

// A closure as D-59 lists it; the page writes its title in Bogotá.
export type ListedClosure = {
  id: string;
  title: string;
  reason: string | null;
};

const START_CHOICES = CLOSURE_START_TIMES.map((time) => ({
  value: time,
  label: formatWallClock(time),
}));
const END_CHOICES = CLOSURE_END_TIMES.map((time) => ({
  value: time,
  label: time === END_OF_DAY ? t.opcionMedianoche : formatWallClock(time),
}));

// Back on D-59 after leaving it, the switches start from what is saved,
// not from a draft that was never saved (FreshOnReturn).
export function HolidaysEditor(
  props: ComponentProps<typeof HolidaysForm>,
) {
  return (
    <FreshOnReturn>
      <HolidaysForm {...props} />
    </FreshOnReturn>
  );
}

// D-59: the holidays of the next 12 months, each one closed unless switched
// on, saved together with "Guardar"; and the closures of the whole
// barbershop, added and removed at once. The sheets live outside the form,
// since forms cannot nest.
function HolidaysForm({
  action,
  addAction,
  removeAction,
  holidays,
  opened,
  closures,
  today,
  saved,
}: {
  action: (
    previous: HolidaysState,
    formData: FormData,
  ) => Promise<HolidaysState>;
  addAction: (
    previous: ClosureState,
    formData: FormData,
  ) => Promise<ClosureState>;
  removeAction: (closureId: string) => Promise<ClosureCommandResult>;
  holidays: readonly Holiday[];
  // The holidays the barbershop opens.
  opened: readonly string[];
  closures: readonly ListedClosure[];
  // In Bogotá, where the sheet's dates start.
  today: string;
  // Back from "Guardar".
  saved: boolean;
}) {
  const form = useFormAction(action, t.errores);
  const [open, setOpen] = useState(() => new Set(opened));
  const controls = useRestoredControls();
  const [adding, setAdding] = useState(false);
  // Remounts the sheet's form, so it starts empty every time it opens.
  const [addRound, setAddRound] = useState(0);
  const [added, setAdded] = useState(false);
  const [removing, setRemoving] = useState<ListedClosure | null>(null);

  function toggle(date: string, on: boolean) {
    setOpen((current) => {
      const next = new Set(current);
      if (on) next.add(date);
      else next.delete(date);
      return next;
    });
  }

  return (
    <>
      <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
        <FlowShell
          header={
            <TopBar
              title={t.titulo}
              titleAs="h1"
              back={{ href: routes.panelShopHours, label: textos.ui.volver }}
            />
          }
          actions={
            <SubmitButton pendingText={t.guardando}>{t.guardar}</SubmitButton>
          }
        >
          <div ref={controls} className="contents">
            {form.formError ? (
              <Notice tone="danger" title={form.formError} />
            ) : saved ? (
              <Notice tone="success" title={t.guardado} />
            ) : null}
            {added ? <Notice tone="success" title={t.agregado} /> : null}
            <h2 className="text-label text-muted">{t.festivos}</h2>
            <p className="text-muted text-sm leading-[1.45]">{t.bajada}</p>
            <ul className="rounded-card border-line flex flex-col overflow-hidden border bg-white">
              {holidays.map((holiday) => (
                <li
                  key={holiday.date}
                  className="border-neutral-soft border-b px-4 py-1 last:border-b-0"
                >
                  <Switch
                    label={holidayDay(holiday.date)}
                    description={holidayNames(holiday.keys)}
                    name="open"
                    value={holiday.date}
                    checked={open.has(holiday.date)}
                    data-checked={open.has(holiday.date)}
                    onChange={(event) =>
                      toggle(holiday.date, event.currentTarget.checked)
                    }
                  />
                </li>
              ))}
            </ul>
            <h2 className="text-label text-muted">{t.cierres}</h2>
            {closures.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon size={28} />}
                title={t.sinCierres}
              >
                {t.sinCierresDetalle}
              </EmptyState>
            ) : (
              <ul className="rounded-card border-line flex flex-col overflow-hidden border bg-white">
                {closures.map((closure) => (
                  <li
                    key={closure.id}
                    className="border-neutral-soft flex min-h-13 items-center gap-3 border-b py-1.5 pr-1.5 pl-4 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body font-semibold">
                        {closure.title}
                      </span>
                      <span className="text-help text-muted leading-[1.35]">
                        {closureSubtitle(closure)}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={t.borrar(closure.title)}
                      onClick={() => {
                        setAdded(false);
                        setRemoving(closure);
                      }}
                      className="text-muted hover:text-danger flex size-11 shrink-0 items-center justify-center rounded-full"
                    >
                      <TrashIcon size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setAdded(false);
                setAddRound((round) => round + 1);
                setAdding(true);
              }}
            >
              <PlusIcon size={18} />
              <span>{t.agregar}</span>
            </Button>
          </div>
        </FlowShell>
      </ActionForm>
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={t.hoja.titulo}
      >
        {adding ? (
          <ClosureForm
            key={addRound}
            action={addAction}
            today={today}
            onAdded={() => {
              setAdding(false);
              setAdded(true);
            }}
          />
        ) : null}
      </Sheet>
      <RemoveClosureSheet
        closure={removing}
        action={removeAction}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

function closureSubtitle(closure: ListedClosure): string {
  return closure.reason
    ? `${t.todaLaBarberia} · ${closure.reason}`
    : t.todaLaBarberia;
}

// The sheet "Agregar cierre" (no design): from and to which day, the whole
// day or between two hours, and an optional reason. Saved at once.
function ClosureForm({
  action,
  today,
  onAdded,
}: {
  action: (previous: ClosureState, formData: FormData) => Promise<ClosureState>;
  today: string;
  onAdded: () => void;
}) {
  const h = t.hoja;
  const form = useFormAction(action, h.errores);
  const [allDay, setAllDay] = useState(true);
  const [fromTime, setFromTime] = useState("12:00");
  const [toTime, setToTime] = useState(END_OF_DAY);
  const controls = useRestoredControls();

  const done = form.state.status === "done";
  useEffect(() => {
    if (done) onAdded();
  }, [done, onAdded]);

  return (
    <ActionForm form={form}>
      <div ref={controls} className="contents">
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <Field
          label={h.desdeFecha}
          name="fromDate"
          type="date"
          min={today}
          defaultValue={form.value("fromDate") ?? today}
          error={form.fieldError("fromDate")}
        />
        <Field
          label={h.hastaFecha}
          name="toDate"
          type="date"
          min={today}
          defaultValue={form.value("toDate") ?? today}
          error={form.fieldError("toDate")}
        />
        <Switch
          label={h.todoElDia}
          name="allDay"
          checked={allDay}
          data-checked={allDay}
          onChange={(event) => setAllDay(event.currentTarget.checked)}
        />
        {allDay ? null : (
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label={h.desdeHora}
              name="fromTime"
              options={START_CHOICES}
              value={fromTime}
              data-value={fromTime}
              onChange={(event) => setFromTime(event.currentTarget.value)}
              error={form.fieldError("fromTime")}
            />
            <SelectField
              label={h.hastaHora}
              name="toTime"
              options={END_CHOICES}
              value={toTime}
              data-value={toTime}
              onChange={(event) => setToTime(event.currentTarget.value)}
              error={form.fieldError("toTime")}
            />
          </div>
        )}
        <Field
          label={h.motivo}
          name="reason"
          optional
          maxLength={MAX_REASON_LENGTH}
          help={h.motivoAyuda}
          defaultValue={form.value("reason") ?? ""}
          error={form.fieldError("reason")}
        />
        <p className="text-help text-muted leading-[1.45]">{h.citas}</p>
        <SubmitButton pendingText={h.guardando}>{h.guardar}</SubmitButton>
      </div>
    </ActionForm>
  );
}

// Confirms before removing a closure: customers can book those hours again.
function RemoveClosureSheet({
  closure,
  action,
  onClose,
}: {
  closure: ListedClosure | null;
  action: (closureId: string) => Promise<ClosureCommandResult>;
  onClose: () => void;
}) {
  const c = t.confirmar;
  const [failed, setFailed] = useState(false);
  const [pending, startRemoving] = useTransition();

  function close() {
    setFailed(false);
    onClose();
  }

  function remove(id: string) {
    setFailed(false);
    startRemoving(async () => {
      const result = await action(id);
      if (result.ok) close();
      else setFailed(true);
    });
  }

  return (
    <Sheet open={closure !== null} onClose={close} title={c.titulo}>
      {closure ? (
        <>
          <p className="text-body leading-[1.45] font-semibold">
            {closure.title}
          </p>
          <p className="text-body leading-[1.45]">{c.cuerpo}</p>
          {failed ? <Notice tone="danger" title={c.fallo} /> : null}
          <Button
            variant="dangerSolid"
            disabled={pending}
            onClick={() => remove(closure.id)}
          >
            {pending ? c.borrando : c.si}
          </Button>
          <Button variant="secondary" size="md" onClick={close}>
            {c.no}
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}
