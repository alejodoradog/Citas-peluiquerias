"use client";

import { useActionState } from "react";
import { requestRecovery } from "@/modulos/cuentas/acciones/auth";
import type { FormState } from "@/modulos/cuentas/acciones/form-state";
import { Field, FormAlert, SubmitButton, useFocusFirstError } from "@/ui/form";
import { textos } from "@/ui/textos";

const t = textos.cuentas.recuperar;
const errores = textos.cuentas.errores;

export function RecoveryForm() {
  const [state, action] = useActionState<FormState, FormData>(
    requestRecovery,
    {},
  );
  const formRef = useFocusFirstError(state.fieldErrors);

  if (state.notice === "recovery_sent") {
    return <FormAlert tone="info">{t.enviado}</FormAlert>;
  }

  const code = state.fieldErrors?.email;
  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="flex flex-col gap-5"
    >
      {state.formError ? (
        <FormAlert>{errores[state.formError]}</FormAlert>
      ) : null}
      <Field
        label={t.campos.email}
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={code ? errores[code] : undefined}
        required
      />
      <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
    </form>
  );
}
