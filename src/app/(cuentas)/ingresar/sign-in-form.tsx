"use client";

import {
  signIn,
  type AccountErrorCode,
} from "@/modulos/cuentas/acciones/account";
import { Field } from "@/ui/field";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
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

  return (
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
      <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
    </ActionForm>
  );
}
