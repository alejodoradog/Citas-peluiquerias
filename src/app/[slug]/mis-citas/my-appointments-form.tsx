"use client";

import { useState } from "react";
import {
  askForMyAppointments,
  type MyAppointmentsState,
} from "@/modulos/agenda/acciones/my-appointments";
import { Field } from "@/ui/field";
import { ActionForm, useFormAction } from "@/ui/form";
import { MailIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { ProtectedSubmit } from "@/ui/turnstile-field";

const t = textos.reservas.misCitas;

// C-19 (the email) and C-20 (the same answer for any email).
export function MyAppointmentsForm({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const form = useFormAction<MyAppointmentsState>(
    askForMyAppointments,
    t.errores,
  );
  const [email, setEmail] = useState("");
  // "Usar otro correo" leaves this answer behind; a new one shows again.
  const [dismissed, setDismissed] = useState<unknown>(null);
  const sent = form.state.status === "done" && form.state !== dismissed;

  if (sent) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pt-6 pb-6">
        <span className="bg-brand-soft text-brand flex size-16 items-center justify-center rounded-full">
          <MailIcon size={30} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title">{t.enviado.titulo}</h1>
          <p className="text-body text-muted">{t.enviado.detalle(email)}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(form.state)}
          className="text-ink min-h-11 self-start font-semibold underline"
        >
          {t.enviado.otro}
        </button>
      </main>
    );
  }

  return (
    <ActionForm
      form={form}
      className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pt-2.5 pb-6"
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">{t.titulo}</h1>
        <p className="text-body text-muted">{t.bajada(name)}</p>
      </div>
      <input type="hidden" name="slug" value={slug} />
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <Field
        label={t.correo}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        defaultValue={form.value("email") ?? ""}
        onChange={(event) => setEmail(event.currentTarget.value.trim())}
        error={form.fieldError("email")}
      />
      <ProtectedSubmit state={form.state} pendingText={t.enviando}>
        {t.enviar}
      </ProtectedSubmit>
    </ActionForm>
  );
}
