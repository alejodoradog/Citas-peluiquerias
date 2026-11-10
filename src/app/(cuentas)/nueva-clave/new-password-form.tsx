"use client";

import { setNewPassword } from "@/modulos/cuentas/acciones/account";
import { Field } from "@/ui/field";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";

const t = textos.cuentas.nuevaClave;

export function NewPasswordForm() {
  const form = useFormAction(setNewPassword, textos.cuentas.errores);

  return (
    <ActionForm form={form}>
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <Field
        label={t.campos.password}
        name="password"
        type="password"
        autoComplete="new-password"
        help={t.ayudas.password}
        error={form.fieldError("password")}
        required
      />
      <Field
        label={t.campos.confirmation}
        name="confirmation"
        type="password"
        autoComplete="new-password"
        error={form.fieldError("confirmation")}
        required
      />
      <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
    </ActionForm>
  );
}
