"use client";

import { useActionState } from "react";
import { setNewPassword } from "@/modulos/cuentas/acciones/auth";
import type { FormState } from "@/modulos/cuentas/acciones/form-state";
import { Field, FormAlert, SubmitButton, useFocusFirstError } from "@/ui/form";
import { textos } from "@/ui/textos";

const t = textos.cuentas.nuevaClave;
const errores = textos.cuentas.errores;

export function NewPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(
    setNewPassword,
    {},
  );
  const formRef = useFocusFirstError(state.fieldErrors);
  const error = (field: string) => {
    const code = state.fieldErrors?.[field];
    return code ? errores[code] : undefined;
  };

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
        label={t.campos.password}
        name="password"
        type="password"
        autoComplete="new-password"
        help={t.ayudas.password}
        error={error("password")}
        required
      />
      <Field
        label={t.campos.confirmation}
        name="confirmation"
        type="password"
        autoComplete="new-password"
        error={error("confirmation")}
        required
      />
      <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
    </form>
  );
}
