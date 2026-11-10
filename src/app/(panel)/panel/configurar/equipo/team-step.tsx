"use client";

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
import { Steps } from "@/ui/steps";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { useSetupDraft } from "../setup-draft";

const t = textos.asistente.equipo;

export function TeamStep({ ownerName }: { ownerName: string }) {
  const { draft, dispatch } = useSetupDraft();
  const form = useFormAction(completeSetup, textos.asistente.errores);
  const offered = offeredServices(draft).length;
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
            <SubmitButton pendingText={t.terminando}>{t.terminar}</SubmitButton>
            <Button type="submit" variant="text" size="md">
              {t.despues}
            </Button>
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
                subtitle={t.resumen(offered)}
              />
            ) : null}
            {draft.barbers.map((barber) => (
              <ListRow
                key={barber.key}
                href={`${routes.setupBarber}?barbero=${encodeURIComponent(barber.key)}`}
                icon={<Avatar name={barber.displayName} size="md" />}
                title={barber.displayName}
                subtitle={t.resumen(barber.serviceKeys.length)}
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
