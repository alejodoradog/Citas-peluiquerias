"use client";

import { useState } from "react";
import type { ImageUploadTicket } from "@/lib/imagenes/keys";
import { routes } from "@/lib/routes";
import type {
  ShopImageCommandResult,
  ShopProfileState,
} from "@/modulos/barberias/acciones/shop-profile";
import {
  readLocation,
  type ShopLocation,
} from "@/modulos/barberias/dominio/profile";
import { Field } from "@/ui/field";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import type { PendingImage } from "../image-upload";
import { LocationField } from "./location-field";
import { CoverField, LogoField } from "./shop-images";

const t = textos.datos;

// What D-57 starts from: the saved data, the WhatsApp as people write it
// and the public URLs of the images.
export type EditableShopProfile = {
  name: string;
  address: string;
  locality: string;
  whatsappPhone: string;
  location: ShopLocation | null;
  logoUrl: string | null;
  coverUrl: string | null;
};

type ShopImage = "logo" | "cover";

// D-57, Más › Datos y fotos: logo, cover, name, address, "Barrio y ciudad",
// the location and the WhatsApp. The form wraps the whole screen so
// "Guardar" sits in the bottom bar. The actions arrive as props.
export function ShopProfileForm({
  action,
  saved,
  requestUpload,
  removeImage,
}: {
  action: (
    previous: ShopProfileState,
    formData: FormData,
  ) => Promise<ShopProfileState>;
  saved: EditableShopProfile;
  requestUpload: (kind: ShopImage, mime: string) => Promise<ImageUploadTicket>;
  removeImage: (kind: ShopImage) => Promise<ShopImageCommandResult>;
}) {
  const form = useFormAction(action, t.errores);

  // Images uploaded in this visit. When the server answers that it refused
  // or deleted one (its path comes back empty), it is dropped here too.
  const [logo, setLogo] = useState<PendingImage | null>(null);
  const [cover, setCover] = useState<PendingImage | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [seenState, setSeenState] = useState(form.state);
  if (form.state !== seenState) {
    setSeenState(form.state);
    const echoedLogo = form.value("logoPath");
    if (logo && echoedLogo !== undefined && echoedLogo !== logo.path) {
      setLogo(null);
    }
    const echoedCover = form.value("coverPath");
    if (cover && echoedCover !== undefined && echoedCover !== cover.path) {
      setCover(null);
    }
  }

  const echoed = form.value("location");
  // After an error, the location sent; unreadable, none.
  const initialLocation =
    echoed !== undefined ? (readLocation(echoed) ?? null) : saved.location;

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <FlowShell
        header={
          <TopBar
            title={t.titulo}
            titleAs="h1"
            back={{ href: routes.panelMore, label: textos.ui.volver }}
          />
        }
        actions={
          <SubmitButton
            pendingText={t.guardando}
            disabled={uploadingLogo || uploadingCover}
          >
            {t.guardar}
          </SubmitButton>
        }
      >
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <LogoField
          barbershopName={saved.name}
          savedUrl={saved.logoUrl}
          pending={logo}
          onPendingChange={setLogo}
          onUploadingChange={setUploadingLogo}
          requestUpload={requestUpload}
          removeSaved={async () => (await removeImage("logo")).ok}
        />
        <CoverField
          savedUrl={saved.coverUrl}
          pending={cover}
          onPendingChange={setCover}
          onUploadingChange={setUploadingCover}
          requestUpload={requestUpload}
          removeSaved={async () => (await removeImage("cover")).ok}
        />
        <Field
          label={t.campos.nombre}
          name="name"
          defaultValue={form.value("name") ?? saved.name}
          help={t.ayudas.nombre}
          error={form.fieldError("name")}
          autoComplete="organization"
        />
        <Field
          label={t.campos.direccion}
          name="address"
          defaultValue={form.value("address") ?? saved.address}
          error={form.fieldError("address")}
          autoComplete="street-address"
        />
        <Field
          label={t.campos.barrio}
          name="locality"
          defaultValue={form.value("locality") ?? saved.locality}
          error={form.fieldError("locality")}
          autoComplete="off"
        />
        {/* Remounted after each answer, so it starts from what came back. */}
        <LocationField
          key={echoed ?? "saved"}
          saved={saved.location}
          initial={initialLocation}
          error={form.fieldError("location")}
        />
        <Field
          label={t.campos.whatsapp}
          name="whatsappPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          defaultValue={form.value("whatsappPhone") ?? saved.whatsappPhone}
          help={t.ayudas.whatsapp}
          error={form.fieldError("whatsappPhone")}
        />
      </FlowShell>
    </ActionForm>
  );
}
