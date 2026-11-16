"use client";

import { useEffect, useState } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { formatWallClock, toBogotaTime } from "@/lib/fechas/fechas";
import type { WalkInState } from "@/modulos/agenda/acciones/walk-in";
import type { WalkInBarber } from "@/modulos/agenda/datos/walk-in";
import {
  walkInEnd,
  walkInStart,
  walkInTotals,
  type WalkInService,
} from "@/modulos/agenda/dominio/walk-in";
import { Checkbox } from "@/ui/checkbox";
import { Field } from "@/ui/field";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { SelectField } from "@/ui/select-field";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { clashLines } from "./clash-message";

const t = textos.citaAlMomento;
const TICK_MS = 15_000;

const clock = (instant: Date) => formatWallClock(toBogotaTime(instant));

// React resets the form after each answer of its action, to what its fields
// had when they mounted. The choices live in this screen's state, so the
// boxes and the select remount after each answer (a new state object is a
// new round) with that state as their default: a refusal keeps them.
const rounds = new WeakMap<object, number>();
let lastRound = 0;
function roundOf(state: object): number {
  let round = rounds.get(state);
  if (round === undefined) {
    round = ++lastRound;
    rounds.set(state, round);
  }
  return round;
}

// "Cita al momento" (task 7.7), the professional's and the owner's: the start
// (now), the services as boxes (the owner chooses the professional first),
// the length, price and end that follow them, and an optional name. The
// database sets the real start and decides whether it fits; this screen
// only shows what it will be. The form wraps the whole screen so "Crear
// cita" sits in the bottom bar.
export function WalkInForm({
  action,
  close,
  startsAt,
  services,
  barbers,
}: {
  action: (previous: WalkInState, formData: FormData) => Promise<WalkInState>;
  close: { href: string; label: string };
  // The start as the server saw it when it drew the page.
  startsAt: Date;
  services: readonly WalkInService[];
  // Only in the owner's screen.
  barbers?: readonly WalkInBarber[];
}) {
  const form = useFormAction(action, t.errores);
  const [barberId, setBarberId] = useState(
    form.value("profesional") || barbers?.[0]?.id || "",
  );
  const [chosen, setChosen] = useState<string[]>([]);
  const [name, setName] = useState(form.value("nombre") ?? "");
  // The clock moves while the screen is open: the start shown follows it.
  const [start, setStart] = useState(startsAt);
  useEffect(() => {
    const timer = setInterval(() => setStart(walkInStart(new Date())), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const barber = barbers?.find((b) => b.id === barberId) ?? null;
  const offered = barbers
    ? services.filter((s) => barber?.serviceIds.includes(s.id))
    : services;
  const picked = chosen.filter((id) => offered.some((s) => s.id === id));
  const totals = walkInTotals(offered, picked);
  const failure = form.state.status === "failed" ? form.state : null;
  const servicesError = form.fieldError("servicios");
  const round = roundOf(form.state);

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <FlowShell
        header={<TopBar title={t.titulo} titleAs="h1" close={close} />}
        actions={
          <>
            <SubmitButton
              pendingText={t.enviando}
              disabled={picked.length === 0}
            >
              {t.enviar}
            </SubmitButton>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body text-muted">
                {totals.count === 0
                  ? t.sinServiciosElegidos
                  : t.total(totals.count, totals.minutes)}
              </span>
              <strong className="text-[1.0625rem] whitespace-nowrap">
                {formatPesos(totals.priceCop)}
              </strong>
            </div>
          </>
        }
      >
        {failure?.error === "walk_in_clash" ? (
          <Notice tone="danger" title={t.choque.titulo}>
              {clashLines(
                failure.clash,
                barber?.name ?? null,
                picked.length,
              ).join(" ")}
          </Notice>
        ) : form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}

        {barbers ? (
          barbers.length === 0 ? (
            <Notice tone="warning" title={t.sinProfesionales} />
          ) : (
            <SelectField
              key={round}
              label={t.profesional}
              name="profesional"
              defaultValue={barberId}
              error={form.fieldError("profesional")}
              onChange={(event) => setBarberId(event.target.value)}
              options={barbers.map((b) => ({ value: b.id, label: b.name }))}
            />
          )
        ) : null}

        <dl className="rounded-card border-line grid grid-cols-2 gap-3 border bg-white px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-help text-muted">{t.empieza}</dt>
            <dd className="text-body font-semibold">{t.ahora(clock(start))}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-help text-muted">{t.termina}</dt>
            <dd className="text-body font-semibold" aria-live="polite">
              {totals.minutes > 0
                ? clock(walkInEnd(start, totals.minutes))
                : "—"}
            </dd>
          </div>
        </dl>

        {offered.length === 0 ? (
          barbers ? (
            barbers.length > 0 ? (
              <Notice tone="warning" title={t.sinServiciosProfesional} />
            ) : null
          ) : (
            <Notice tone="warning" title={t.sinServicios.titulo}>
              {t.sinServicios.detalle}
            </Notice>
          )
        ) : (
          <fieldset
            className="flex flex-col"
            aria-describedby={servicesError ? "servicios-error" : undefined}
          >
            <legend className="text-muted mb-3.5 text-sm font-semibold">
              {t.servicios}
            </legend>
            <div
              key={round}
              className="rounded-card border-line flex flex-col border bg-white px-4 py-2"
            >
              {offered.map((service) => (
                <Checkbox
                  key={service.id}
                  name="servicios"
                  value={service.id}
                  label={service.name}
                  description={textos.agenda.servicios.detalle(
                    service.durationMinutes,
                    formatPesos(service.priceCop),
                  )}
                  defaultChecked={picked.includes(service.id)}
                  onChange={(event) =>
                    setChosen((current) =>
                      event.target.checked
                        ? [...current, service.id]
                        : current.filter((id) => id !== service.id),
                    )
                  }
                />
              ))}
            </div>
            {servicesError ? (
              <p id="servicios-error" className="text-danger text-help mt-1.5">
                {servicesError}
              </p>
            ) : null}
          </fieldset>
        )}

        <Field
          label={t.nombre}
          name="nombre"
          autoComplete="off"
          optional
          help={t.nombreAyuda}
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={form.fieldError("nombre")}
        />
        <p className="text-muted text-[13px]">{t.aviso}</p>
      </FlowShell>
    </ActionForm>
  );
}
