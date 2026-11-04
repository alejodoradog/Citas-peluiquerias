"use client";

import { requestPasswordRecovery } from "@/modulos/cuentas/acciones/account";
import {
  ActionForm,
  Field,
  FormAlert,
  SubmitButton,
  useFormAction,
} from "@/ui/form";
import { textos } from "@/ui/textos";

const t = textos.cuentas.recuperar;

export function RecoveryForm() {
  const form = useFormAction(requestPasswordRecovery, textos.cuentas.errores);

  if (form.notice === "recovery_sent") {
    return <FormAlert tone="info">{t.enviado}</FormAlert>;
  }

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
      <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
    </ActionForm>
  );
}
