"use client";

import { useActionState } from "react";
import { registerBarbershop } from "@/modulos/barberias/acciones/register";
import type { FormState } from "@/modulos/cuentas/acciones/form-state";
import { Field, FormAlert, SubmitButton, useFocusFirstError } from "@/ui/form";
import { textos } from "@/ui/textos";

const t = textos.cuentas.registro;
const errores = textos.cuentas.errores;

export function RegistrationForm() {
  const [state, action] = useActionState<FormState, FormData>(
    registerBarbershop,
    {},
  );
  const formRef = useFocusFirstError(state.fieldErrors);

  if (state.notice === "check_email") {
    return <FormAlert tone="info">{t.revisaCorreo}</FormAlert>;
  }

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
        label={t.campos.ownerName}
        name="ownerName"
        autoComplete="name"
        defaultValue={state.values?.ownerName}
        error={error("ownerName")}
        required
      />
      <Field
        label={t.campos.barbershopName}
        name="barbershopName"
        autoComplete="organization"
        defaultValue={state.values?.barbershopName}
        error={error("barbershopName")}
        required
      />
      <Field
        label={t.campos.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        defaultValue={state.values?.phone}
        help={t.ayudas.phone}
        error={error("phone")}
        required
      />
      <Field
        label={t.campos.email}
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        help={t.ayudas.email}
        error={error("email")}
        required
      />
      <Field
        label={t.campos.password}
        name="password"
        type="password"
        autoComplete="new-password"
        help={t.ayudas.password}
        error={error("password")}
        required
      />
      <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
    </form>
  );
}
