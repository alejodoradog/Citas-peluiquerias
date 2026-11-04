"use client";

import { signIn } from "@/modulos/cuentas/acciones/account";
import {
  ActionForm,
  Field,
  FormAlert,
  SubmitButton,
  useFormAction,
} from "@/ui/form";
import { textos } from "@/ui/textos";

const t = textos.cuentas.ingreso;

export function SignInForm() {
  const form = useFormAction(signIn, textos.cuentas.errores);

  return (
    <ActionForm form={form}>
      {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
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
