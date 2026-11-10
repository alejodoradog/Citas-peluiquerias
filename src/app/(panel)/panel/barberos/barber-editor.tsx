"use client";

import { useState, useTransition } from "react";
import { routes } from "@/lib/routes";
import type {
  BarberActionErrorCode,
  BarberCommandResult,
  BarberState,
  ImageUploadTicket,
} from "@/modulos/barberias/acciones/barbers";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Chip } from "@/ui/chip";
import { Field } from "@/ui/field";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { ClockIcon, LinkIcon, WarningIcon } from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { Switch } from "@/ui/switch";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { PhotoField, type PendingPhoto } from "./photo-field";

const t = textos.barberos;
const SERVICES_ERROR_ID = "servicios-error";

export type EditableBarber = {
  id: string;
  displayName: string;
  email: string | null;
  emailNotifications: boolean;
  photoUrl: string | null;
  serviceIds: string[];
  active: boolean;
  isOwner: boolean;
  linkActive: boolean;
  // "2 de noviembre" when inactive.
  inactiveSince: string | null;
};

// D-54: create a barber (no barber) or edit one. The form wraps the whole
// screen so "Guardar" can sit in the bottom bar; the deactivation sheet sits
// outside it, since forms cannot nest. The actions arrive as props, so the
// screen does not care which one saves.
export function BarberEditor({
  action,
  barber,
  services,
  hoursSummary,
  requestUpload,
  setActive,
  removePhoto,
}: {
  action: (previous: BarberState, formData: FormData) => Promise<BarberState>;
  barber: EditableBarber | null;
  services: ReadonlyArray<{ id: string; name: string }>;
  hoursSummary: string;
  requestUpload: (kind: "barbers", mime: string) => Promise<ImageUploadTicket>;
  setActive?: (
    barberId: string,
    active: boolean,
  ) => Promise<BarberCommandResult>;
  removePhoto?: (barberId: string) => Promise<BarberCommandResult>;
}) {
  const form = useFormAction(action, t.errores);

  // A photo uploaded in this visit. When the server answers that it refused
  // or deleted it (photoPath comes back empty), it is dropped here too.
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [seenState, setSeenState] = useState(form.state);
  if (form.state !== seenState) {
    setSeenState(form.state);
    const echoed = form.value("photoPath");
    if (pending && echoed !== undefined && echoed !== pending.path) {
      setPending(null);
    }
  }

  const [hasEmail, setHasEmail] = useState(
    () => (form.value("email") ?? barber?.email ?? "").trim() !== "",
  );
  const [notify, setNotify] = useState(barber?.emailNotifications ?? false);

  // After an error the form shows again what the owner chose; before that, a
  // new barber does every active service (decision 4 of task 2.2).
  const echoedServices = form.value("serviceIds");
  const chosen = new Set(
    echoedServices !== undefined
      ? echoedServices.split(",").filter(Boolean)
      : (barber?.serviceIds ?? services.map((service) => service.id)),
  );
  const servicesError = form.fieldError("serviceIds");

  const [confirming, setConfirming] = useState(false);
  const [commandError, setCommandError] =
    useState<BarberActionErrorCode | null>(null);
  const [changing, startChanging] = useTransition();

  function changeActive(active: boolean) {
    if (!barber || !setActive) return;
    setCommandError(null);
    startChanging(async () => {
      // On success the action goes back to the list.
      const result = await setActive(barber.id, active);
      if (result && !result.ok) setCommandError(result.error);
    });
  }

  const removeSaved =
    barber && removePhoto && barber.photoUrl
      ? async () => (await removePhoto(barber.id)).ok
      : undefined;

  return (
    <>
      <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
        <FlowShell
          header={
            <TopBar
              title={barber ? barber.displayName : t.nuevo}
              titleAs="h1"
              close={{ href: routes.panelBarbers, label: textos.ui.cerrar }}
            />
          }
          actions={
            <SubmitButton pendingText={t.guardando} disabled={uploading}>
              {t.guardar}
            </SubmitButton>
          }
        >
          {barber ? (
            <input type="hidden" name="barberId" value={barber.id} />
          ) : null}
          {barber?.inactiveSince ? (
            <Notice
              tone="warning"
              title={t.inactivoAviso(barber.inactiveSince)}
            >
              {t.inactivoDetalle}
            </Notice>
          ) : null}
          {form.formError ? (
            <Notice tone="danger" title={form.formError} />
          ) : null}
          {commandError && !confirming ? (
            <Notice tone="danger" title={t.errores[commandError]} />
          ) : null}
          <PhotoField
            name="photoPath"
            personName={barber?.displayName || "?"}
            savedUrl={barber?.photoUrl ?? null}
            pending={pending}
            onPendingChange={setPending}
            onUploadingChange={setUploading}
            requestUpload={requestUpload}
            removeSaved={removeSaved}
          />
          <Field
            label={t.campos.nombre}
            name="displayName"
            defaultValue={form.value("displayName") ?? barber?.displayName}
            help={t.ayudas.nombre}
            error={form.fieldError("displayName")}
            autoComplete="off"
          />
          <Field
            label={t.campos.correo}
            name="email"
            type="email"
            optional
            defaultValue={form.value("email") ?? barber?.email ?? ""}
            onChange={(event) =>
              setHasEmail(event.currentTarget.value.trim() !== "")
            }
            help={t.ayudas.correo}
            error={form.fieldError("email")}
            autoComplete="off"
          />
          <div className="rounded-card border-line border bg-white px-4 py-3">
            <Switch
              label={t.avisos}
              description={hasEmail ? t.avisosAyuda : t.avisosSinCorreo}
              name="emailNotifications"
              checked={notify}
              onChange={(event) => setNotify(event.currentTarget.checked)}
              // Without an email there is nowhere to send them. A switch
              // already on stays usable, so the owner can turn it off.
              disabled={!hasEmail && !notify}
            />
          </div>
          <List>
            {/* D-55 needs a saved barber; a new one gets the barbershop's. */}
            <ListRow
              icon={<ClockIcon />}
              title={t.horario}
              subtitle={hoursSummary}
              href={barber ? routes.panelBarberSchedule(barber.id) : undefined}
            />
            <ListRow
              icon={<LinkIcon />}
              title={t.linkPrivado}
              subtitle={
                !barber ? t.linkNuevo : barber.isOwner ? t.linkDueno : undefined
              }
              trailing={
                barber && !barber.isOwner ? (
                  barber.linkActive ? (
                    <Chip tone="success">{t.linkActivoChip}</Chip>
                  ) : (
                    <Chip tone="neutral">{t.linkDesactivadoChip}</Chip>
                  )
                ) : undefined
              }
            />
          </List>
          <fieldset
            className="min-w-0 pt-1"
            aria-describedby={servicesError ? SERVICES_ERROR_ID : undefined}
          >
            <legend className="text-label text-muted pb-2.5">
              {t.servicios}
            </legend>
            {services.length > 0 ? (
              <div className="rounded-card border-line flex flex-col gap-0.5 border bg-white px-4 py-2">
                {services.map((service) => (
                  <Checkbox
                    key={service.id}
                    label={service.name}
                    name="serviceIds"
                    value={service.id}
                    defaultChecked={chosen.has(service.id)}
                    aria-invalid={servicesError ? true : undefined}
                    aria-describedby={
                      servicesError ? SERVICES_ERROR_ID : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-help text-muted leading-[1.45]">
                {t.sinServicios}
              </p>
            )}
            {servicesError ? (
              <p
                id={SERVICES_ERROR_ID}
                className="text-help text-danger flex items-start gap-1.5 pt-2"
              >
                <span className="flex pt-px">
                  <WarningIcon size={16} />
                </span>
                <span>{servicesError}</span>
              </p>
            ) : null}
          </fieldset>
          {barber && setActive && !barber.isOwner ? (
            barber.active ? (
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => {
                    setCommandError(null);
                    setConfirming(true);
                  }}
                >
                  {t.desactivar(barber.displayName)}
                </Button>
                <p className="text-help text-muted leading-[1.45]">
                  {t.desactivarAyuda}
                </p>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="md"
                disabled={changing}
                onClick={() => changeActive(true)}
              >
                {changing ? t.reactivando : t.reactivar(barber.displayName)}
              </Button>
            )
          ) : null}
        </FlowShell>
      </ActionForm>
      {barber && setActive && !barber.isOwner && barber.active ? (
        <Sheet
          open={confirming}
          onClose={() => setConfirming(false)}
          title={t.confirmar.titulo(barber.displayName)}
        >
          <p className="text-body leading-[1.45]">{t.confirmar.cuerpo}</p>
          {commandError ? (
            <Notice tone="danger" title={t.errores[commandError]} />
          ) : null}
          <Button
            variant="dangerSolid"
            disabled={changing}
            onClick={() => changeActive(false)}
          >
            {changing
              ? t.confirmar.desactivando
              : t.confirmar.si(barber.displayName)}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setConfirming(false)}
          >
            {t.confirmar.no}
          </Button>
        </Sheet>
      ) : null}
    </>
  );
}
