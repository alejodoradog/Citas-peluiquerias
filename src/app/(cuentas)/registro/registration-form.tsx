"use client";

import { useState, useSyncExternalStore } from "react";
import { yapoinWhatsapp } from "@/lib/contacto/whatsapp";
import { routes } from "@/lib/routes";
import { registerBarbershop } from "@/modulos/barberias/acciones/barbershops";
import {
  BUSINESS_TYPE_OTHER_MAX,
  BUSINESS_TYPES,
} from "@/modulos/barberias/dominio/business-type";
import {
  planFromParam,
  SIGNUP_PLANS,
  type SignupPlan,
} from "@/modulos/suscripciones/dominio/plans";
import { TRIAL_DAYS } from "@/modulos/suscripciones/dominio/trial";
import { cx } from "@/ui/cx";
import { AuthHeading } from "@/ui/auth-shell";
import { ButtonLink } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Field } from "@/ui/field";
import { ActionForm, useFormAction } from "@/ui/form";
import { SelectField, type SelectOption } from "@/ui/select-field";
import { ProtectedSubmit } from "@/ui/turnstile-field";
import { MailIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { Steps } from "@/ui/steps";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.cuentas.registro;
const messages = { ...textos.cuentas.errores, ...textos.barberias.errores };

// The first one is no choice at all: the owner has to pick a kind.
const BUSINESS_OPTIONS: SelectOption[] = [
  { value: "", label: t.tipos.elegir },
  ...BUSINESS_TYPES.map((type) => ({ value: type, label: t.tipos[type] })),
];

const p = textos.planes.registro;

// The plan the landing chose (?plan=2), read once in the browser: the
// server renders plan 1, the default (task 7.8).
const noSubscription = () => () => {};
const planInUrl = () =>
  planFromParam(new URLSearchParams(window.location.search).get("plan"));
const planOnServer = (): SignupPlan => "standard";

function isSignupPlan(value: string | undefined): value is SignupPlan {
  return (SIGNUP_PLANS as readonly string[]).includes(value ?? "");
}

export function RegistrationForm() {
  const form = useFormAction(registerBarbershop, messages);
  const urlPlan = useSyncExternalStore(noSubscription, planInUrl, planOnServer);
  const sent = form.value("plan");
  const [picked, setPicked] = useState<SignupPlan | null>(
    isSignupPlan(sent) ? sent : null,
  );
  const plan = picked ?? urlPlan;
  // Kept on this device only, to say where the link went (D-03).
  const [email, setEmail] = useState(form.value("email") ?? "");
  // Controlled, to show "¿Cuál?" only when the kind is "other".
  const [businessType, setBusinessType] = useState(
    form.value("businessType") ?? "",
  );

  if (form.notice === "check_email") {
    return <CheckEmail email={email} />;
  }

  return (
    <>
      <Steps current={1} total={4} />
      <AuthHeading
        title={t.titulo}
        intro={plan === "plus" ? p.bajadaPlan2 : t.bajada}
      />
      <ActionForm form={form}>
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <PlanChoice plan={plan} onChange={setPicked} />
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
        <SelectField
          label={t.campos.businessType}
          name="businessType"
          options={BUSINESS_OPTIONS}
          value={businessType}
          onChange={(event) => setBusinessType(event.target.value)}
          error={form.fieldError("businessType")}
          required
        />
        {businessType === "other" ? (
          <Field
            label={t.campos.businessTypeOther}
            name="businessTypeOther"
            maxLength={BUSINESS_TYPE_OTHER_MAX}
            defaultValue={form.value("businessTypeOther")}
            error={form.fieldError("businessTypeOther")}
            required
          />
        ) : null}
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
        {/* The express authorization of Ley 1581 (task 6.5). */}
        <div className="flex flex-col gap-1">
          <Checkbox
            name="acepto"
            label={textos.legal.casilla.registro}
            defaultChecked={form.value("acepto") === "on"}
            aria-invalid={form.fieldError("acepto") ? true : undefined}
          />
          {form.fieldError("acepto") ? (
            <p role="alert" className="text-danger text-help">
              {form.fieldError("acepto")}
            </p>
          ) : null}
        </div>
        <p className="text-help text-muted leading-[1.45]">
          {t.legal.antes}
          <TextLink href={routes.termsFromApp}>{t.legal.terminos}</TextLink>
          {t.legal.y}
          <TextLink href={routes.privacyFromApp}>{t.legal.privacidad}</TextLink>
          {t.legal.despues}
        </p>
        <ProtectedSubmit state={form.state} pendingText={t.enviando}>
          {t.enviar}
        </ProtectedSubmit>
      </ActionForm>
      <p className="text-label text-muted text-center leading-[1.45] font-normal">
        {t.yaTienes} <TextLink href={routes.signIn}>{t.ingresa}</TextLink>
      </p>
    </>
  );
}

// Task 7.8: plan 1 (with the free trial) or plan 2 (from its first
// payment). "Por acuerdo" is agreed by WhatsApp.
function PlanChoice({
  plan,
  onChange,
}: {
  plan: SignupPlan;
  onChange: (plan: SignupPlan) => void;
}) {
  const options = [
    { value: "standard", ...p.plan1, detalle: p.plan1.detalle(TRIAL_DAYS) },
    { value: "plus", ...p.plan2 },
  ] as const;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-label mb-1 font-semibold">{p.leyenda}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cx(
            "border-line flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border bg-white px-3.5 py-3",
            "has-checked:border-brand has-checked:bg-brand-soft has-checked:border-2 has-checked:px-3.25 has-checked:py-2.75",
            "has-focus-visible:outline-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
          )}
        >
          <input
            type="radio"
            name="plan"
            value={option.value}
            checked={plan === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <span className="font-semibold">{option.nombre}</span>
          <span className="text-help text-muted">{option.detalle}</span>
        </label>
      ))}
      <p className="text-help text-muted">
        {p.masDe8}{" "}
        <a
          href={yapoinWhatsapp(textos.landing.precios.acuerdo.mensaje)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-strong inline-flex min-h-11 items-center font-semibold underline"
        >
          {p.escribenos}
        </a>
      </p>
    </fieldset>
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
