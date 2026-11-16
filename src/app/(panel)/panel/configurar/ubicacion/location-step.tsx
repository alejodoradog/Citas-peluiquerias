"use client";

import { routes } from "@/lib/routes";
import { saveSetupLocation } from "@/modulos/barberias/acciones/setup";
import {
  readLocation,
  type ShopLocation,
} from "@/modulos/barberias/dominio/profile";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { Steps } from "@/ui/steps";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { LocationField } from "../../datos/location-field";

const t = textos.asistente.ubicacion;

// The location step of the wizard (task 7.3). The point comes from the
// phone's GPS only (founder, 2026-11-15): the owner marks it standing at the
// establishment. "Continuar" saves it; without a point it says so.
export function LocationStep({
  saved,
  shopName,
  logoUrl,
}: {
  saved: ShopLocation | null;
  shopName: string;
  logoUrl: string | null;
}) {
  const form = useFormAction(saveSetupLocation, t.errores);
  // What came back from the server after an error, or what is saved.
  const echoed = form.value("location");
  const initial = echoed === undefined ? saved : (readLocation(echoed) ?? null);

  return (
    <ActionForm form={form} className="contents">
      <FlowShell
        header={
          <TopBar
            title={t.barra}
            subtitle={t.paso}
            back={{ href: routes.setup, label: textos.ui.volver }}
          />
        }
        actions={
          <SubmitButton pendingText={t.guardando}>{t.continuar}</SubmitButton>
        }
      >
        <Steps current={3} total={4} announce={false} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title">{t.titulo}</h1>
          <p className="text-body text-muted">{t.bajada}</p>
        </div>
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        {/* Remounted after each answer, so it starts from what came back. */}
        <LocationField
          key={echoed ?? "saved"}
          saved={saved}
          initial={initial}
          shopName={shopName}
          logoUrl={logoUrl}
          error={form.fieldError("location")}
          required
        />
      </FlowShell>
    </ActionForm>
  );
}
