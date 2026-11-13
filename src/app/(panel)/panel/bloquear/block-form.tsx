"use client";

import { useState } from "react";
import { fromBogota } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { createOwnerBlockAction } from "@/modulos/agenda/acciones/owner-appointment";
import { BLOCK_REASONS } from "@/modulos/agenda/dominio/barber-agenda";
import { appointmentsInBlock } from "@/modulos/agenda/dominio/owner-slots";
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
const QUARTER_TIME = /^([01]\d|2[0-3]):(00|15|30|45)$/;

type Appointment = {
  barberId: string;
  start: Date;
  end: Date;
  customerName: string;
};

// D-39: who (a barber or the whole barbershop), the day, from and until
// (quarter hours) and the reason, the chips of B-04. While appointments sit
// in those hours the warning of D-39 names them and "Bloquear" waits: they
// are moved or cancelled first (the database refuses it too).
export function OwnerBlockForm({
  barbers,
  days,
  times,
  appointments,
  defaults,
}: {
  barbers: { id: string; name: string }[];
  days: SelectOption[];
  times: SelectOption[];
  appointments: Appointment[];
  defaults: { quien: string; dia: string; desde: string; hasta: string };
}) {
  const form = useFormAction(createOwnerBlockAction, textos.agenda.rechazos);
  const [values, setValues] = useState({
    quien: form.value("quien") ?? defaults.quien,
    dia: form.value("dia") ?? defaults.dia,
    desde: form.value("desde") ?? defaults.desde,
    hasta: form.value("hasta") ?? defaults.hasta,
  });
  const [reason, setReason] = useState(form.value("motivo") ?? "");
  const set = (field: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const valid =
    QUARTER_TIME.test(values.desde) &&
    QUARTER_TIME.test(values.hasta) &&
    values.hasta > values.desde;
  const inTheWay = valid
    ? appointmentsInBlock(
        appointments,
        values.quien === "" ? null : values.quien,
        {
          start: fromBogota(values.dia, values.desde),
          end: fromBogota(values.dia, values.hasta),
        },
      )
    : [];
  const who =
    barbers.find((barber) => barber.id === values.quien)?.name ?? null;
  const listed = inTheWay
    .map((a) => t.citaCorta(a.customerName, timeLabel(a.start)))
    .join(", ");
  const reasonError = form.fieldError("motivo");

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
            {t.enviar}
          </SubmitButton>
        }
      >
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <SelectField
          label={t.quien}
          name="quien"
          help={t.ayudaQuien}
          value={values.quien}
          error={form.fieldError("quien")}
          onChange={(event) => set("quien")(event.target.value)}
          options={[
            ...barbers.map((barber) => ({
              value: barber.id,
              label: barber.name,
            })),
            { value: "", label: t.todaLaBarberia },
          ]}
        />
        <SelectField
          label={t.dia}
          name="dia"
          options={days}
          value={values.dia}
          error={form.fieldError("dia")}
          onChange={(event) => set("dia")(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
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
          <Notice
            tone="warning"
            icon={<ClockIcon />}
            title={
              who
                ? t.conCitas(who, inTheWay.length)
                : t.conCitasTodos(inTheWay.length)
            }
          >
            {inTheWay.length === 1
              ? t.unaEnMedio(listed)
              : t.variasEnMedio(listed)}
          </Notice>
        ) : null}
      </FlowShell>
    </ActionForm>
  );
}
