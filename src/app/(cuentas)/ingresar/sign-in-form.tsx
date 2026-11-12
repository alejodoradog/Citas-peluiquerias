"use client";

import {
  resendConfirmation,
  signIn,
  type AccountErrorCode,
} from "@/modulos/cuentas/acciones/account";
import { Field } from "@/ui/field";
import { ActionForm, useFormAction } from "@/ui/form";
import { ProtectedSubmit } from "@/ui/turnstile-field";
import { Notice, type NoticeTone } from "@/ui/notice";
import { textos } from "@/ui/textos";

const t = textos.cuentas.ingreso;

// D-06: what the owner can fix by waiting or confirming is a warning; a wrong
// password or a failure is an error.
function toneOf(code: AccountErrorCode | undefined): NoticeTone {
  return code === "email_not_confirmed" || code === "rate_limited"
    ? "warning"
    : "danger";
}

export function SignInForm() {
  const form = useFormAction(signIn, textos.cuentas.errores);
  const unconfirmed = form.formErrorCode === "email_not_confirmed";

  return (
    <>
      <ActionForm form={form}>
        {form.formError ? (
          <Notice tone={toneOf(form.formErrorCode)} title={form.formError} />
        ) : null}
        <Field
          label={t.campos.email}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={form.value("email")}
          error={form.fieldError("email")}
          required
        />
        <Field
          label={t.campos.password}
          name="password"
          type="password"
          autoComplete="current-password"
          error={form.fieldError("password")}
          required
        />
        <ProtectedSubmit state={form.state} pendingText={t.enviando}>
          {t.enviar}
        </ProtectedSubmit>
      </ActionForm>
      {unconfirmed ? (
        // Keyed by email: another unconfirmed account gets its own button
        // instead of the notice left by the previous one.
        <ResendConfirmationForm
          key={form.value("email") ?? ""}
          email={form.value("email") ?? ""}
        />
      ) : null}
    </>
  );
}

// Task 3.5b: a separate form, so the new link carries its own Turnstile
// token (the sign-in spent the other one). It sits outside the sign-in form
// because forms cannot nest.
function ResendConfirmationForm({ email }: { email: string }) {
  const form = useFormAction(resendConfirmation, textos.cuentas.errores);
  const r = t.reenviar;

  if (form.notice === "confirmation_sent") {
    return (
      <Notice tone="success" title={r.enviadoTitulo}>
        {r.enviado}
      </Notice>
    );
  }
  return (
    <ActionForm form={form}>
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <input type="hidden" name="email" value={email} />
      <ProtectedSubmit state={form.state} pendingText={r.enviando}>
        {r.enviar}
      </ProtectedSubmit>
    </ActionForm>
  );
}
