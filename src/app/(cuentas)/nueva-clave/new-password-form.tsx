"use client";

import { routes } from "@/lib/routes";
import { setNewPassword } from "@/modulos/cuentas/acciones/account";
import { Checkbox } from "@/ui/checkbox";
import { Field } from "@/ui/field";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.cuentas.nuevaClave;
const w = textos.cuentas.invitacion;
const legal = textos.cuentas.registro.legal;

// D-09. `welcome`: the professional who opened their invitation (task
// 7.6b) also accepts the terms of use and the data policy, as at sign-up.
export function NewPasswordForm({ welcome = false }: { welcome?: boolean }) {
  const form = useFormAction(setNewPassword, textos.cuentas.errores);

  return (
    <ActionForm form={form}>
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      <Field
        label={welcome ? w.campos.password : t.campos.password}
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
      {welcome ? (
        <>
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
            {legal.antes}
            <TextLink href={routes.termsFromApp}>{legal.terminos}</TextLink>
            {legal.y}
            <TextLink href={routes.privacyFromApp}>{legal.privacidad}</TextLink>
            {legal.despues}
          </p>
        </>
      ) : null}
      <SubmitButton pendingText={t.enviando}>
        {welcome ? w.enviar : t.enviar}
      </SubmitButton>
    </ActionForm>
  );
}
