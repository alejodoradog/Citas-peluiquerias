import type { Metadata } from "next";
import { Suspense } from "react";
import { publicImageUrl } from "@/lib/imagenes/keys";
import { routes } from "@/lib/routes";
import { requestImageUpload } from "@/modulos/barberias/acciones/images";
import {
  removeShopImage,
  saveShopProfile,
} from "@/modulos/barberias/acciones/shop-profile";
import { getShopProfile } from "@/modulos/barberias/datos/shop-profile";
import { displayWhatsapp } from "@/modulos/barberias/dominio/profile";
import { FlowShell } from "@/ui/flow-shell";
import { FreshOnReturn } from "@/ui/fresh-on-return";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../ready-owner";
import { ShopProfileForm } from "./shop-profile-form";

const t = textos.datos;

export const metadata: Metadata = { title: t.titulo };

// D-57, Más › Datos y fotos.
export default function ShopProfilePage() {
  return (
    <Suspense fallback={<ShopProfileLoading />}>
      <ShopProfile />
    </Suspense>
  );
}

// Its bar, so the owner can leave, while the data loads.
function ShopProfileLoading() {
  return (
    <FlowShell
      header={
        <TopBar
          title={t.titulo}
          titleAs="h1"
          back={{ href: routes.panelMore, label: textos.ui.volver }}
        />
      }
    >
      <LoadingState label={t.cargando} />
    </FlowShell>
  );
}

async function ShopProfile() {
  const { barbershop } = await requireReadyOwner();
  const saved = await getShopProfile(barbershop.id);
  // Keyed by the saved texts and location, so the fields start from them
  // when Next.js shows a payload it kept and then refreshes it; and start
  // from them again when the owner leaves a draft unsaved and comes back
  // (FreshOnReturn). Not by the images: "Quitar logo" refreshes the page,
  // and must not throw away what the owner is typing.
  return (
    <FreshOnReturn>
      <ShopProfileForm
        key={JSON.stringify([
          saved.name,
          saved.address,
          saved.locality,
          saved.whatsappPhone,
          saved.location,
        ])}
        action={saveShopProfile}
        saved={{
          name: saved.name,
          address: saved.address ?? "",
          locality: saved.locality ?? "",
          whatsappPhone: displayWhatsapp(saved.whatsappPhone),
          location: saved.location,
          logoUrl: saved.logoPath ? publicImageUrl(saved.logoPath) : null,
          coverUrl: saved.coverPath ? publicImageUrl(saved.coverPath) : null,
        }}
        requestUpload={requestImageUpload}
        removeImage={removeShopImage}
      />
    </FreshOnReturn>
  );
}
