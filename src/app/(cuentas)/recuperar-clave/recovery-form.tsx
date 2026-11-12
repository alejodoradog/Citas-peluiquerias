"use client";

import type { ReactNode } from "react";
import { routes } from "@/lib/routes";
import { requestPasswordRecovery } from "@/modulos/cuentas/acciones/account";
import { AuthHeading } from "@/ui/auth-shell";
import { Field } from "@/ui/field";
import { ActionForm, useFormAction } from "@/ui/form";
import { ProtectedSubmit } from "@/ui/turnstile-field";
import { Notice } from "@/ui/notice";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.cuentas.recuperar;

// D-07. Once sent, the whole screen becomes D-08: the same answer whether or
// not the email has an account.
export function RecoveryForm({ notice }: { notice?: ReactNode }) {
  const form = useFormAction(requestPasswordRecovery, textos.cuentas.errores);
  const sent = form.notice === "recovery_sent";

  return (
    <>
      <AuthHeading title={t.titulo} intro={sent ? undefined : t.bajada} />
      {sent ? (
        <Notice tone="success" title={t.enviadoTitulo}>
          {t.enviado}
        </Notice>
      ) : (
        <>
          {notice}
          <ActionForm form={form}>
            {form.formError ? (
              <Notice tone="danger" title={form.formError} />
            ) : null}
            <Field
              label={t.campos.email}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={form.value("email")}
              error={form.fieldError("email")}
              required
            />
            <ProtectedSubmit state={form.state} pendingText={t.enviando}>
              {t.enviar}
            </ProtectedSubmit>
          </ActionForm>
        </>
      )}
      <TextLink href={routes.signIn} standalone>
        {t.volver}
      </TextLink>
    </>
  );
}
