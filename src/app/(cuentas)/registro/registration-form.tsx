"use client";

import { useState } from "react";
import { routes } from "@/lib/routes";
import { registerBarbershop } from "@/modulos/barberias/acciones/barbershops";
import { AuthHeading } from "@/ui/auth-shell";
import { ButtonLink } from "@/ui/button";
import { Field } from "@/ui/field";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { MailIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { Steps } from "@/ui/steps";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.cuentas.registro;
const messages = { ...textos.cuentas.errores, ...textos.barberias.errores };

export function RegistrationForm() {
  const form = useFormAction(registerBarbershop, messages);
  // Kept on this device only, to say where the link went (D-03).
  const [email, setEmail] = useState(form.value("email") ?? "");

  if (form.notice === "check_email") {
    return <CheckEmail email={email} />;
  }

  return (
    <>
      <Steps current={1} total={3} />
      <AuthHeading title={t.titulo} intro={t.bajada} />
      <ActionForm form={form}>
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
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
          onChange={(event) => setEmail(event.target.value.trim())}
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
        <p className="text-help text-muted leading-[1.45]">
          {t.legal.antes}
          <TextLink href={routes.terms}>{t.legal.terminos}</TextLink>
          {t.legal.y}
          <TextLink href={routes.privacy}>{t.legal.privacidad}</TextLink>
          {t.legal.despues}
        </p>
        <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
      </ActionForm>
      <p className="text-label text-muted text-center leading-[1.45] font-normal">
        {t.yaTienes} <TextLink href={routes.signIn}>{t.ingresa}</TextLink>
      </p>
    </>
  );
}

// D-03. The same words whether or not the email already had an account
// (decision 0004): the second sentence covers that case.
function CheckEmail({ email }: { email: string }) {
  const r = t.revisaCorreo;
  return (
    <>
      <AuthHeading
        icon={<MailIcon size={44} />}
        title={r.titulo}
        intro={r.cuerpo(email)}
      />
      <Notice tone="info" title={r.avisoTitulo}>
        {r.avisoCuerpo}
      </Notice>
      <ButtonLink href={routes.signIn} variant="secondary">
        {r.irAIngresar}
      </ButtonLink>
    </>
  );
}
