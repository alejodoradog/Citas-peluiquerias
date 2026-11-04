"use client";

import { useActionState } from "react";
import { signIn } from "@/modulos/cuentas/acciones/auth";
import type { FormState } from "@/modulos/cuentas/acciones/form-state";
import { Field, FormAlert, SubmitButton, useFocusFirstError } from "@/ui/form";
import { textos } from "@/ui/textos";

const t = textos.cuentas.ingreso;
const errores = textos.cuentas.errores;

export function SignInForm() {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
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
        label={t.campos.email}
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={error("email")}
        required
      />
      <Field
        label={t.campos.password}
        name="password"
        type="password"
        autoComplete="current-password"
        error={error("password")}
        required
      />
      <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
    </form>
  );
}
