"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { routes } from "@/lib/routes";
import {
  parseBarberForm,
  type BarberErrorCode,
} from "@/modulos/barberias/dominio/barber";
import { offeredServices } from "@/modulos/barberias/dominio/setup";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Checkbox } from "@/ui/checkbox";
import { Field } from "@/ui/field";
import { LoadingState } from "@/ui/states";
import { FlowShell } from "@/ui/flow-shell";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { useSetupDraft } from "../../setup-draft";

const t = textos.asistente.barbero;
const errores = textos.asistente.errores;

type Errors = Partial<
  Record<"displayName" | "email" | "serviceKeys", BarberErrorCode | "invalid">
>;

export function BarberForm({ hoursSummary }: { hoursSummary: string }) {
  const { ready } = useSetupDraft();
  // The form starts from the draft: wait until a reload restored it.
  return ready ? (
    <BarberFormFields hoursSummary={hoursSummary} />
  ) : (
    <LoadingState />
  );
}

function BarberFormFields({ hoursSummary }: { hoursSummary: string }) {
  const { draft, dispatch } = useSetupDraft();
  const router = useRouter();
  const key = useSearchParams().get("barbero");
  const barber = draft.barbers.find((b) => b.key === key) ?? null;
  const services = offeredServices(draft);
  const [name, setName] = useState(barber?.displayName ?? "");
  const [errors, setErrors] = useState<Errors>({});

  function backToTeam() {
    router.push(routes.setupTeam);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = parseBarberForm({
      displayName: String(data.get("displayName") ?? ""),
      email: String(data.get("email") ?? ""),
      serviceKeys: data.getAll("serviceKeys").map(String),
    });
    if (!result.success) {
      setErrors(result.errors);
      requestAnimationFrame(() =>
        form
          .querySelector<HTMLElement>(
            '[aria-invalid="true"], [data-error="true"] input',
          )
          ?.focus(),
      );
      return;
    }
    dispatch({
      type: "save_barber",
      barber: {
        key: barber?.key ?? `barbero-${crypto.randomUUID()}`,
        displayName: result.data.displayName,
        email: result.data.email,
        serviceKeys: result.data.serviceKeys,
      },
    });
    backToTeam();
  }

  const title = barber ? t.editar : t.agregar;

  return (
    <form noValidate onSubmit={submit} className="contents">
      <FlowShell
        header={
          <TopBar
            title={title}
            close={{ href: routes.setupTeam, label: textos.ui.cerrar }}
          />
        }
        actions={
          <>
            <Button type="submit">{t.guardar}</Button>
            {barber ? (
              <Button
                variant="text"
                size="md"
                onClick={() => {
                  dispatch({ type: "remove_barber", key: barber.key });
                  backToTeam();
                }}
              >
                {t.quitar}
              </Button>
            ) : null}
          </>
        }
      >
        <h1 className="sr-only">{title}</h1>
        <div className="flex items-center gap-3.5">
          <Avatar name={name || "?"} size="lg" />
          <p className="text-help text-muted">{t.fotoDespues}</p>
        </div>
        <Field
          label={t.campos.nombre}
          name="displayName"
          defaultValue={barber?.displayName}
          onChange={(event) => setName(event.target.value)}
          help={t.ayudas.nombre}
          error={errors.displayName ? errores[errors.displayName] : undefined}
          autoComplete="off"
        />
        <Field
          label={t.campos.correo}
          name="email"
          type="email"
          optional
          defaultValue={barber?.email ?? ""}
          help={t.ayudas.correo}
          error={errors.email ? errores[errors.email] : undefined}
          autoComplete="off"
        />
        <fieldset
          className="flex flex-col gap-2"
          data-error={errors.serviceKeys ? "true" : undefined}
          aria-describedby={errors.serviceKeys ? "servicios-error" : undefined}
        >
          <legend className="text-label text-muted mb-2">{t.servicios}</legend>
          <Card className="gap-0 py-2">
            {services.map((service) => (
              <Checkbox
                key={service.key}
                label={service.name}
                name="serviceKeys"
                value={service.key}
                defaultChecked={
                  barber ? barber.serviceKeys.includes(service.key) : true
                }
              />
            ))}
          </Card>
          {errors.serviceKeys ? (
            <p id="servicios-error" className="text-help text-danger">
              {errores[errors.serviceKeys]}
            </p>
          ) : null}
        </fieldset>
        <section className="flex flex-col gap-2">
          <h2 className="text-label text-muted">{t.horario}</h2>
          <Card>
            <p className="text-body font-semibold">{t.usaHorario}</p>
            <p className="text-help text-muted">{hoursSummary}</p>
            <p className="text-help text-muted">{t.horarioPropio}</p>
          </Card>
        </section>
      </FlowShell>
    </form>
  );
}
