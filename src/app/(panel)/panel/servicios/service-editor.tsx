"use client";

import { routes } from "@/lib/routes";
import type { ServiceState } from "@/modulos/barberias/acciones/services";
import { DURATION_OPTIONS } from "@/modulos/barberias/dominio/service";
import { Checkbox } from "@/ui/checkbox";
import { Field } from "@/ui/field";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { SelectField } from "@/ui/select-field";
import { Switch } from "@/ui/switch";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";

const t = textos.servicios;
const pesos = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

// A new service starts at 30 minutes, as in the wizard (task 2.1, decision 12).
const DEFAULT_DURATION = 30;

export type EditableService = {
  id: string;
  name: string;
  priceCop: number;
  durationMinutes: number;
  active: boolean;
  barberIds: string[];
};

// D-52: create a service (no service) or edit one. The form wraps the whole
// screen so "Guardar" can sit in the bottom bar. The action arrives as a prop
// (createService or updateService), so the screen does not care which.
export function ServiceEditor({
  action,
  service,
  barbers,
}: {
  action: (previous: ServiceState, formData: FormData) => Promise<ServiceState>;
  service: EditableService | null;
  barbers: ReadonlyArray<{ id: string; displayName: string }>;
}) {
  const form = useFormAction(action, t.errores);

  // After an error the form shows again what the owner chose; before that, a
  // new service is done by every active barber (decision 4 of task 2.2).
  const echoedBarbers = form.value("barberIds");
  const chosen = new Set(
    echoedBarbers !== undefined
      ? echoedBarbers.split(",").filter(Boolean)
      : (service?.barberIds ?? barbers.map((barber) => barber.id)),
  );
  const echoedActive = form.value("active");
  const active =
    echoedActive !== undefined ? echoedActive === "on" : service?.active;

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <FlowShell
        header={
          <TopBar
            title={service ? t.editar : t.nuevo}
            titleAs="h1"
            close={{ href: routes.panelServices, label: textos.ui.cerrar }}
          />
        }
        actions={
          <SubmitButton pendingText={t.guardando}>{t.guardar}</SubmitButton>
        }
      >
        {service ? (
          <input type="hidden" name="serviceId" value={service.id} />
        ) : null}
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <Field
          label={t.campos.nombre}
          name="name"
          defaultValue={form.value("name") ?? service?.name}
          error={form.fieldError("name")}
          autoComplete="off"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t.campos.precio}
            name="price"
            prefix="$"
            inputMode="numeric"
            defaultValue={
              form.value("price") ??
              (service ? pesos.format(service.priceCop) : "")
            }
            error={form.fieldError("price")}
            autoComplete="off"
          />
          <SelectField
            label={t.campos.duracion}
            name="duration"
            defaultValue={
              form.value("duration") ??
              String(service?.durationMinutes ?? DEFAULT_DURATION)
            }
            options={DURATION_OPTIONS.map((minutes) => ({
              value: String(minutes),
              label: t.duracion(minutes),
            }))}
            error={form.fieldError("duration")}
          />
        </div>
        <p className="text-help text-muted leading-[1.45]">{t.ayudaDuracion}</p>
        <fieldset className="min-w-0 pt-1">
          <legend className="text-label text-muted pb-2.5">{t.quien}</legend>
          {barbers.length > 0 ? (
            <div className="rounded-card border-line flex flex-col gap-0.5 border bg-white px-4 py-2">
              {barbers.map((barber) => (
                <Checkbox
                  key={barber.id}
                  label={barber.displayName}
                  name="barberIds"
                  value={barber.id}
                  defaultChecked={chosen.has(barber.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-help text-muted leading-[1.45]">
              {t.sinBarberos}
            </p>
          )}
        </fieldset>
        {service ? (
          <div className="rounded-card border-line border bg-white px-4 py-3">
            <Switch
              label={t.activo}
              description={t.activoAyuda}
              name="active"
              defaultChecked={active}
            />
          </div>
        ) : null}
      </FlowShell>
    </ActionForm>
  );
}
