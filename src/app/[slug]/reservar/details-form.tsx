"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { routes } from "@/lib/routes";
import {
  bookAppointment,
  type BookingState,
} from "@/modulos/agenda/acciones/booking";
import { Field } from "@/ui/field";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { InfoIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { SummaryBar } from "../booking-ui";
import { customerStorage, type StoredCustomer } from "./customer-storage";

const t = textos.reservas.datos;

// The form of C-06. What the customer saved on this phone fills it (only
// from the browser); "Borrar mis datos" forgets it.
export function DetailsForm({
  header,
  hidden,
  priceCop,
  servicesHref,
  children,
}: {
  header: ReactNode;
  hidden: {
    slug: string;
    servicios: string[];
    barbero: string;
    dia: string;
    hora: string;
  };
  priceCop: number;
  servicesHref: string;
  children: ReactNode;
}) {
  const form = useFormAction<BookingState>(
    bookAppointment,
    textos.reservas.errores,
  );
  const [stored, setStored] = useState<{
    value: StoredCustomer | null;
    fromSaved: boolean;
    version: number;
  }>({ value: null, fromSaved: false, version: 0 });

  // Read after mounting: storage exists only in the browser.
  useEffect(() => {
    const draft = customerStorage.draft();
    const saved = draft ? null : customerStorage.saved();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser storage after mounting
    setStored((current) => ({
      value: draft ?? saved,
      fromSaved: saved !== null,
      version: current.version + 1,
    }));
  }, []);

  function forget() {
    customerStorage.forget();
    setStored((current) => ({
      value: null,
      fromSaved: false,
      version: current.version + 1,
    }));
  }

  const initial = (field: "name" | "email" | "phone") =>
    form.value(field) ?? stored.value?.[field] ?? "";

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      {header}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-5 pt-2.5 pb-4">
        <input type="hidden" name="slug" value={hidden.slug} />
        {hidden.servicios.map((id) => (
          <input key={id} type="hidden" name="servicios" value={id} />
        ))}
        <input type="hidden" name="barbero" value={hidden.barbero} />
        <input type="hidden" name="dia" value={hidden.dia} />
        <input type="hidden" name="hora" value={hidden.hora} />
        {children}
        {form.formError ? (
          <Notice tone="danger" title={form.formError}>
            {form.formErrorCode === "services_changed" ? (
              <Link href={servicesHref} className="font-bold">
                {t.serviciosCambiaron}
              </Link>
            ) : null}
          </Notice>
        ) : null}
        {stored.fromSaved && stored.value ? (
          <div
            role="status"
            className="bg-brand-soft flex gap-2.5 rounded-[14px] px-3.5 py-3"
          >
            <span className="text-brand-strong">
              <InfoIcon size={20} />
            </span>
            <div className="flex flex-col items-start gap-1">
              <strong className="text-brand-strong text-sm">
                {t.guardados}
              </strong>
              <span className="text-help">{t.noEres(stored.value.name)}</span>
              <button
                type="button"
                onClick={forget}
                className="text-brand-strong min-h-11 text-sm font-bold"
              >
                {t.borrar}
              </button>
            </div>
          </div>
        ) : null}
        <div key={stored.version} className="flex flex-col gap-3.5">
          <Field
            label={t.nombre}
            name="name"
            autoComplete="name"
            maxLength={100}
            defaultValue={initial("name")}
            error={form.fieldError("name")}
          />
          <Field
            label={t.correo}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            defaultValue={initial("email")}
            help={t.correoAyuda}
            error={form.fieldError("email")}
          />
          <Field
            label={t.celular}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            optional
            placeholder={t.celularEjemplo}
            maxLength={20}
            defaultValue={initial("phone")}
            help={t.celularAyuda}
            error={form.fieldError("phone")}
          />
        </div>
        <p className="text-help text-muted">
          {t.aceptas} <Link href={routes.privacy}>{t.politica}</Link>{" "}
          {t.deLaBarberia}
        </p>
      </main>
      <SummaryBar summary={t.total} priceCop={priceCop}>
        <SaveDraftOnSubmit />
        <SubmitButton pendingText={t.confirmando}>{t.confirmar}</SubmitButton>
      </SummaryBar>
    </ActionForm>
  );
}

// Keeps what was typed for C-07 ("Tus datos quedan guardados") the moment
// the form is sent, from the form's own fields.
function SaveDraftOnSubmit() {
  useEffect(() => {
    function save(event: SubmitEvent) {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      const data = new FormData(target);
      // Only this form: the page of an earlier step may still be mounted.
      if (!data.has("email") || !data.has("hora")) return;
      customerStorage.saveDraft({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
      });
    }
    document.addEventListener("submit", save, true);
    return () => document.removeEventListener("submit", save, true);
  }, []);
  return null;
}
