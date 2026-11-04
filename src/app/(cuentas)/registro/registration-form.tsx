"use client";

import { registerBarbershop } from "@/modulos/barberias/acciones/barbershops";
import {
  ActionForm,
  Field,
  FormAlert,
  SubmitButton,
  useFormAction,
} from "@/ui/form";
import { textos } from "@/ui/textos";

const t = textos.cuentas.registro;
const messages = { ...textos.cuentas.errores, ...textos.barberias.errores };

export function RegistrationForm() {
  const form = useFormAction(registerBarbershop, messages);

  if (form.notice === "check_email") {
    return <FormAlert tone="info">{t.revisaCorreo}</FormAlert>;
  }

  return (
    <ActionForm form={form}>
      {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
      <Field
        label={t.campos.ownerName}
        name="ownerName"
        autoComplete="name"
        defaultValue={form.value("ownerName")}
        error={form.fieldError("ownerName")}
        required
      />
      <Field
        label={t.campos.barbershopName}
        name="barbershopName"
        autoComplete="organization"
        defaultValue={form.value("barbershopName")}
        error={form.fieldError("barbershopName")}
        required
      />
      <Field
        label={t.campos.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        defaultValue={form.value("phone")}
        help={t.ayudas.phone}
        error={form.fieldError("phone")}
        required
      />
      <Field
        label={t.campos.email}
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={form.value("email")}
        help={t.ayudas.email}
        error={form.fieldError("email")}
        required
      />
      <Field
        label={t.campos.password}
        name="password"
        type="password"
        autoComplete="new-password"
        help={t.ayudas.password}
        error={form.fieldError("password")}
        required
      />
      <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
    </ActionForm>
  );
}
