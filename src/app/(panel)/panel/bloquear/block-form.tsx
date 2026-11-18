"use client";

import { useState } from "react";
import type { BogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { createOwnerBlockAction } from "@/modulos/agenda/acciones/owner-appointment";
import {
  BLOCK_REASONS,
  parseBlockForm,
} from "@/modulos/agenda/dominio/barber-agenda";
import type { BlockTargetKind } from "@/modulos/agenda/dominio/owner-block";
import { appointmentsInBlock } from "@/modulos/agenda/dominio/owner-slots";
import { Checkbox } from "@/ui/checkbox";
import { cx } from "@/ui/cx";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { ClockIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { SelectField, type SelectOption } from "@/ui/select-field";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { timeLabel } from "../agenda-labels";

const t = textos.agenda.bloquear;

type Appointment = {
  barberId: string;
  start: Date;
  end: Date;
  customerName: string;
};

// The days of the picker with nothing open to block (task 8.14), for each
// choice: the owner's own agenda (empty when they do not attend), each other
// professional and the whole establishment.
export type ClosedDays = {
  mine: readonly BogotaDate[];
  barbers: Readonly<Record<string, readonly BogotaDate[]>>;
  shop: readonly BogotaDate[];
};

// D-39 and task 8.14: what is blocked ("Mi agenda", one professional or the
// whole establishment, each saying what happens), the day, "Todo el día" or
// from and until (quarter hours), and the reason, the chips of B-04. While
// appointments sit in those hours the warning of D-39 names them and the
// button waits: they are moved or cancelled first (the database refuses it
// too). The days already closed for the choice are offered but cannot be
// chosen, as in the professional's form (task 7.4).
export function OwnerBlockForm({
  owner,
  barbers,
  days,
  closed,
  times,
  appointments,
  today,
  now,
  defaults,
}: {
  // The owner's row when they attend: "Mi agenda" exists only then.
  owner: { id: string; name: string } | null;
  // The other active professionals.
  barbers: { id: string; name: string }[];
  days: SelectOption[];
  closed: ClosedDays;
  times: SelectOption[];
  appointments: Appointment[];
  today: BogotaDate;
  now: Date;
  defaults: {
    para: BlockTargetKind;
    profesional: string;
    dia: string;
    desde: string;
    hasta: string;
  };
}) {
  const form = useFormAction(createOwnerBlockAction, textos.agenda.rechazos);
  const kinds: BlockTargetKind[] = [
    ...(owner ? (["mine"] as const) : []),
    ...(barbers.length > 0 ? (["barber"] as const) : []),
    "shop",
  ];
  const sentKind = form.value("para") as BlockTargetKind | undefined;
  const [kind, setKind] = useState<BlockTargetKind>(
    sentKind && kinds.includes(sentKind) ? sentKind : defaults.para,
  );
  const [values, setValues] = useState({
    profesional: form.value("profesional") || defaults.profesional,
    dia: form.value("dia") ?? defaults.dia,
    desde: form.value("desde") ?? defaults.desde,
    hasta: form.value("hasta") ?? defaults.hasta,
  });
  const [wholeDay, setWholeDay] = useState(form.value("todoElDia") === "on");
  const [reason, setReason] = useState(form.value("motivo") ?? "");

  const closedFor = (next: BlockTargetKind, barberId: string) =>
    new Set<string>(
      next === "mine"
        ? closed.mine
        : next === "barber"
          ? (closed.barbers[barberId] ?? [])
          : closed.shop,
    );
  const closedDays = closedFor(kind, values.profesional);
  // A day closed for the new choice is left for the first one open.
  const choose = (next: BlockTargetKind, barberId: string) => {
    const shut = closedFor(next, barberId);
    setKind(next);
    setValues((current) => ({
      ...current,
      profesional: barberId,
      dia: shut.has(current.dia)
        ? (days.find((day) => !shut.has(day.value))?.value ?? current.dia)
        : current.dia,
    }));
  };
  const set = (field: "dia" | "desde" | "hasta") => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const barberId =
    kind === "mine"
      ? (owner?.id ?? null)
      : kind === "barber"
        ? values.profesional
        : null;
  // The same reading of the form the server makes, for the warning.
  const parsed = parseBlockForm(
    {
      dia: values.dia,
      desde: values.desde,
      hasta: values.hasta,
      motivo: "other",
      todoElDia: wholeDay ? "on" : "",
    },
    today,
    now,
  );
  const inTheWay = parsed.success
    ? appointmentsInBlock(appointments, barberId, parsed.data)
    : [];
  const chosenBarber =
    barbers.find((barber) => barber.id === values.profesional) ?? null;
  const listed = inTheWay
    .map((a) => t.citaCorta(a.customerName, timeLabel(a.start)))
    .join(", ");
  const reasonError = form.fieldError("motivo");
  const kindError = form.fieldError("para");

  const submit =
    kind === "mine"
      ? t.enviarMia
      : kind === "barber" && chosenBarber
        ? t.enviarA(chosenBarber.name)
        : t.enviarEstablecimiento;
  const warning =
    kind === "mine"
      ? t.conCitasMia(inTheWay.length)
      : kind === "barber" && chosenBarber
        ? t.conCitas(chosenBarber.name, inTheWay.length)
        : t.conCitasTodos(inTheWay.length);

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <FlowShell
        header={
          <TopBar
            title={t.titulo}
            titleAs="h1"
            close={{ href: routes.panel, label: textos.ui.cerrar }}
          />
        }
        actions={
          <SubmitButton pendingText={t.enviando} disabled={inTheWay.length > 0}>
            {submit}
          </SubmitButton>
        }
      >
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <fieldset
          className="flex flex-col gap-2"
          aria-describedby={kindError ? "para-error" : undefined}
        >
          <legend className="text-muted mb-2 text-sm font-semibold">
            {t.para}
          </legend>
          {kinds.map((option) => (
            <label
              key={option}
              className={cx(
                "border-line text-ink flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-white px-3.5 py-3",
                "has-checked:border-brand has-checked:bg-brand-soft has-checked:border-2 has-checked:px-3.25 has-checked:py-2.75",
                "has-focus-visible:outline-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
              )}
            >
              <input
                type="radio"
                name="para"
                value={option}
                checked={kind === option}
                onChange={() =>
                  choose(
                    option,
                    option === "barber"
                      ? (chosenBarber?.id ?? barbers[0]?.id ?? "")
                      : values.profesional,
                  )
                }
                className="sr-only"
                aria-labelledby={`para-${option}-titulo`}
                aria-describedby={`para-${option}-ayuda`}
              />
              <span className="flex flex-col gap-0.5">
                <span
                  id={`para-${option}-titulo`}
                  className="text-sm font-semibold"
                >
                  {t.opciones[option].titulo}
                </span>
                <span
                  id={`para-${option}-ayuda`}
                  className="text-muted text-[13px]"
                >
                  {t.opciones[option].ayuda}
                </span>
              </span>
            </label>
          ))}
          {kindError ? (
            <p id="para-error" className="text-danger text-help">
              {kindError}
            </p>
          ) : null}
        </fieldset>
        {kind === "barber" ? (
          <SelectField
            label={t.profesional}
            name="profesional"
            value={values.profesional}
            error={form.fieldError("profesional")}
            onChange={(event) => choose("barber", event.target.value)}
            options={barbers.map((barber) => ({
              value: barber.id,
              label: barber.name,
            }))}
          />
        ) : null}
        <SelectField
          label={t.dia}
          name="dia"
          options={days.map((day) =>
            closedDays.has(day.value)
              ? {
                  value: day.value,
                  label: textos.barbero.bloquear.diaCerrado(day.label),
                  disabled: true,
                }
              : day,
          )}
          value={values.dia}
          error={form.fieldError("dia")}
          onChange={(event) => set("dia")(event.target.value)}
        />
        <Checkbox
          name="todoElDia"
          label={t.todoElDia}
          description={t.todoElDiaAyuda[kind]}
          checked={wholeDay}
          onChange={(event) => setWholeDay(event.target.checked)}
        />
        <div className={cx("grid grid-cols-2 gap-3", wholeDay && "hidden")}>
          <SelectField
            label={t.desde}
            name="desde"
            options={times}
            value={values.desde}
            error={form.fieldError("desde")}
            onChange={(event) => set("desde")(event.target.value)}
          />
          <SelectField
            label={t.hasta}
            name="hasta"
            options={times}
            value={values.hasta}
            error={form.fieldError("hasta")}
            onChange={(event) => set("hasta")(event.target.value)}
          />
        </div>
        <fieldset
          className="flex flex-col gap-2"
          aria-describedby={reasonError ? "motivo-error" : undefined}
        >
          <legend className="text-muted mb-2 text-sm font-semibold">
            {t.motivo}
          </legend>
          <div className="flex flex-wrap gap-2">
            {BLOCK_REASONS.map((value) => (
              <label
                key={value}
                className={cx(
                  "border-line text-ink flex min-h-11 cursor-pointer items-center rounded-full border bg-white px-3.5 text-sm font-semibold",
                  "has-checked:border-brand has-checked:bg-brand-soft has-checked:border-2 has-checked:px-3.25",
                  "has-focus-visible:outline-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
                )}
              >
                <input
                  type="radio"
                  name="motivo"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="sr-only"
                />
                {textos.barbero.bloquear.motivos[value]}
              </label>
            ))}
          </div>
          {reasonError ? (
            <p id="motivo-error" className="text-danger text-help">
              {reasonError}
            </p>
          ) : null}
        </fieldset>
        {inTheWay.length > 0 ? (
          <Notice tone="warning" icon={<ClockIcon />} title={warning}>
            {inTheWay.length === 1
              ? t.unaEnMedio(listed)
              : t.variasEnMedio(listed)}
          </Notice>
        ) : null}
      </FlowShell>
    </ActionForm>
  );
}
