"use client";

import { useId, useState, type FormEvent } from "react";
import {
  DURATION_OPTIONS,
  parseServiceForm,
  sameServiceName,
  type ServiceErrorCode,
} from "@/modulos/barberias/dominio/service";
import type { DraftService } from "@/modulos/barberias/dominio/setup";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { SelectField } from "@/ui/select-field";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.asistente.servicio;
const errores = textos.asistente.errores;
const pesos = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Errors = Partial<
  Record<"name" | "price" | "duration", ServiceErrorCode | "invalid">
>;

// D-11: edit a suggested service or add a new one. It works on the draft only;
// nothing reaches the server until the owner finishes the wizard.
export function ServiceSheet({
  open,
  service,
  takenNames,
  onClose,
  onSave,
  onRemove,
}: {
  open: boolean;
  service: DraftService | null;
  takenNames: string[];
  onClose: () => void;
  onSave: (service: DraftService) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={service ? t.editar : t.nuevo}>
      {open ? (
        <ServiceForm
          key={service?.key ?? "new"}
          service={service}
          takenNames={takenNames}
          onSave={onSave}
          onRemove={onRemove}
        />
      ) : null}
    </Sheet>
  );
}

function ServiceForm({
  service,
  takenNames,
  onSave,
  onRemove,
}: {
  service: DraftService | null;
  takenNames: string[];
  onSave: (service: DraftService) => void;
  onRemove: (key: string) => void;
}) {
  const formId = useId();
  const [errors, setErrors] = useState<Errors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = parseServiceForm({
      name: String(data.get("name") ?? ""),
      price: String(data.get("price") ?? ""),
      duration: String(data.get("duration") ?? ""),
    });
    const next: Errors = result.success ? {} : { ...result.errors };
    if (
      result.success &&
      takenNames.some((name) => sameServiceName(name, result.data.name))
    ) {
      next.name = "service_name_taken";
    }
    setErrors(next);
    if (!result.success || next.name) {
      // Move to the first field with an error once React shows it.
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    onSave({
      key: service?.key ?? `nuevo-${crypto.randomUUID()}`,
      name: result.data.name,
      priceCop: result.data.price,
      durationMinutes: result.data.duration,
      offered: service?.offered ?? true,
    });
  }

  const message = (code: ServiceErrorCode | "invalid" | undefined) =>
    code ? errores[code] : undefined;

  return (
    <form
      id={formId}
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-3.5"
    >
      <Field
        label={t.campos.nombre}
        name="name"
        defaultValue={service?.name}
        error={message(errors.name)}
        autoComplete="off"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t.campos.precio}
          name="price"
          prefix="$"
          inputMode="numeric"
          defaultValue={service ? pesos.format(service.priceCop) : ""}
          error={message(errors.price)}
          autoComplete="off"
        />
        <SelectField
          label={t.campos.duracion}
          name="duration"
          defaultValue={String(service?.durationMinutes ?? 30)}
          options={DURATION_OPTIONS.map((minutes) => ({
            value: String(minutes),
            label: textos.asistente.servicios.duracion(minutes),
          }))}
          error={message(errors.duration)}
        />
      </div>
      <p className="text-help text-muted leading-[1.45]">{t.ayudaDuracion}</p>
      <Button type="submit">{t.guardar}</Button>
      {service ? (
        <Button variant="text" size="md" onClick={() => onRemove(service.key)}>
          {t.quitar}
        </Button>
      ) : null}
    </form>
  );
}
