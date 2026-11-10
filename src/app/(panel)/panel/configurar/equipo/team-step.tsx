"use client";

import { useFormStatus } from "react-dom";
import { routes } from "@/lib/routes";
import { completeSetup } from "@/modulos/barberias/acciones/setup";
import {
  offeredServices,
  toSetupPayload,
} from "@/modulos/barberias/dominio/setup";
import { Avatar } from "@/ui/avatar";
import { Button, ButtonLink } from "@/ui/button";
import { Card } from "@/ui/card";
import { Checkbox } from "@/ui/checkbox";
import { Chip } from "@/ui/chip";
import { FlowShell } from "@/ui/flow-shell";
import { SubmitButton, useFormAction } from "@/ui/form";
import { PlusIcon } from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { Steps } from "@/ui/steps";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { useSetupDraft } from "../setup-draft";

const t = textos.asistente.equipo;

export function TeamStep({ ownerName }: { ownerName: string }) {
  const { ready } = useSetupDraft();
  // The team starts from the draft: wait until a reload restored it.
  return ready ? <Team ownerName={ownerName} /> : <LoadingState />;
}

// "Lo hago después" saves the same as "Terminar" (decision 3), so it waits
// too while the setup is being saved.
function LaterButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="text"
      size="md"
      disabled={disabled || pending}
    >
      {t.despues}
    </Button>
  );
}

function Team({ ownerName }: { ownerName: string }) {
  const { draft, dispatch } = useSetupDraft();
  const form = useFormAction(completeSetup, textos.asistente.errores);
  const offered = offeredServices(draft);
  const offeredKeys = new Set(offered.map((s) => s.key));
  // A barber whose services were all unchecked in step 2 cannot be saved.
  const withoutServices = draft.barbers.filter(
    (b) => !b.serviceKeys.some((key) => offeredKeys.has(key)),
  );
  const blocked = offered.length === 0 || withoutServices.length > 0;
  const payload = JSON.stringify(toSetupPayload(draft, ownerName));

  return (
    <form action={form.formAction} className="contents">
      <input type="hidden" name="setup" value={payload} />
      <FlowShell
        header={
          <TopBar
            title={t.barra}
            subtitle={t.paso}
            back={{ href: routes.setup, label: textos.ui.volver }}
          />
        }
        actions={
          <>
            {blocked ? (
              <Button disabled>{t.terminar}</Button>
            ) : (
              <SubmitButton pendingText={t.terminando}>
                {t.terminar}
              </SubmitButton>
            )}
            <LaterButton disabled={blocked} />
          </>
        }
      >
        <Steps current={3} total={3} announce={false} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title">{t.titulo}</h1>
          <p className="text-body text-muted">{t.bajada}</p>
        </div>
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        {offered.length === 0 ? (
          <Notice
            tone="warning"
            title={t.sinServiciosTodos}
            action={<a href={routes.setup}>{t.volverServicios}</a>}
          />
        ) : withoutServices.length > 0 ? (
          <Notice
            tone="warning"
            title={t.sinServicios(
              withoutServices.map((b) => b.displayName).join(", "),
            )}
          />
        ) : null}
        <Card>
          <Checkbox
            label={t.yoCorto}
            description={t.yoCortoAyuda}
            checked={draft.ownerCuts}
            onChange={(event) =>
              dispatch({ type: "set_owner_cuts", value: event.target.checked })
            }
          />
        </Card>
        {draft.ownerCuts || draft.barbers.length > 0 ? (
          <List>
            {draft.ownerCuts ? (
              <ListRow
                icon={<Avatar name={ownerName} size="md" />}
                title={ownerName}
                badge={<Chip tone="brand">{t.tu}</Chip>}
                subtitle={t.resumen(offered.length)}
              />
            ) : null}
            {draft.barbers.map((barber) => (
              <ListRow
                key={barber.key}
                href={`${routes.setupBarber}?barbero=${encodeURIComponent(barber.key)}`}
                icon={<Avatar name={barber.displayName} size="md" />}
                title={barber.displayName}
                subtitle={t.resumen(
                  barber.serviceKeys.filter((key) => offeredKeys.has(key))
                    .length,
                )}
              />
            ))}
          </List>
        ) : null}
        <ButtonLink href={routes.setupBarber} variant="secondary" size="md">
          <PlusIcon size={18} />
          {t.agregar}
        </ButtonLink>
      </FlowShell>
    </form>
  );
}
